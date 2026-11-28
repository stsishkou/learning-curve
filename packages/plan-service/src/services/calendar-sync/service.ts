import { CALENDAR_PROVIDERS, type CalendarProvider, type Plan } from '@lc/plan-domain'
import type { CalendarSync, InboxItem } from '@lc/plan-domain/sync'

import type { Actor } from '../../actor'
import { failureMessage, type PlanFailure } from '../../failure'
import { CalendarAuthError, type CalendarConnector, type PlanPorts } from '../../ports'
import { ended } from '../../queue'
import { fail, ok, type Result } from '../../result'
import { ownPlace, placeOf, type PlanPlace } from '../place'
import type { PlanService } from '../plans'
import { acceptProposals, rejectProposals } from './proposals'
import { syncRound, type SyncSession } from './round'

/** What the planner shows of one app's sync; nothing secret. */
export interface CalendarStatus {
  provider: CalendarProvider
  /** False on a read-only host, where nothing is synced */
  writable: boolean
  /** A client id and secret are saved */
  configured: boolean
  /** When the account was connected; null when it is not */
  connectedAt: number | null
  calendars: number
  events: number
  /** Edits made in the app that wait for a decision */
  inbox: InboxItem[]
  lastRound: number | null
  /** When an edit made in the app was last taken into the plan; the planner then reads the plan again */
  takenAt: number | null
  /** A `CalendarProblem` the planner explains, or what failed in the app's words */
  error: string | null
}

/**
 * How a sign-in to a calendar app ended when it did not connect, as the planner explains it: cancelled on the app's
 * page (the transport reads that from the app's answer and never gets this far), access to the calendars left out,
 * the client refused, or anything else.
 */
export type CalendarSignInFailure = 'denied' | 'scope' | 'client' | 'failed'

/**
 * Keeps the actor's plan in the calendar apps the host is connected to. A round reads what changed in an app's
 * calendars, takes the person's edits there into the plan as steps Undo takes back, holds the few that need a
 * decision, then writes what the plan has and the app does not. Rounds and decisions run one at a time, whichever app
 * they are for, and one at a time with those of another host over the same store (the web app and the MCP server).
 *
 * Every method can answer `signed-out` or `not-found` as the plan's own reads do. One that decides or changes the
 * sign-in answers `forbidden` to a reader, as the owner is on a read-only host, where no round runs.
 */
export interface CalendarSyncService {
  /** How the plan is kept in each app, in the order of `CALENDAR_PROVIDERS`. */
  readonly statuses: (actor: Actor) => Promise<Result<readonly CalendarStatus[], PlanFailure>>
  readonly status: (actor: Actor, provider: CalendarProvider) => Promise<Result<CalendarStatus, PlanFailure>>
  /**
   * One round with `provider`, now. A call while a round waits to start joins it; one while it runs gets the next.
   * Where the plan cannot be written, or the app is not connected, no round runs and the status is answered as it
   * is. What stopped a round is kept in the status as `error`.
   */
  readonly sync: (actor: Actor, provider: CalendarProvider) => Promise<Result<CalendarStatus, PlanFailure>>
  /**
   * A round with every app after a save, so each connected app is sent the change. Never rejects, so a save starts it
   * without waiting: a fault outside a round reaches nobody, and the next status read meets it again.
   */
  readonly syncAll: (actor: Actor) => Promise<void>
  /**
   * Takes the app's version of the chosen held edits into the plan; one the plan has moved past since gets the
   * plan's version. A round follows.
   */
  readonly accept: (
    actor: Actor,
    provider: CalendarProvider,
    ids: readonly string[],
  ) => Promise<Result<CalendarStatus, PlanFailure>>
  /** Keeps the plan's version of the chosen held edits, written over the edit in the app. A round follows. */
  readonly reject: (
    actor: Actor,
    provider: CalendarProvider,
    ids: readonly string[],
  ) => Promise<Result<CalendarStatus, PlanFailure>>
  /** Keeps the person's own OAuth client for the app, which its sign-in then uses. */
  readonly saveClient: (
    actor: Actor,
    provider: CalendarProvider,
    id: string,
    secret: string,
  ) => Promise<Result<CalendarStatus, PlanFailure>>
  /**
   * The app's sign-in page, coming back to `redirect` with a code. Rejects with `CalendarAuthError` `client` when no
   * client is known.
   */
  readonly connectAddress: (
    actor: Actor,
    provider: CalendarProvider,
    redirect: string,
  ) => Promise<Result<string, PlanFailure>>
  /**
   * Finishes the sign-in `connectAddress` started and starts the app's first round without waiting for it. A sign-in
   * that expired, is not this one or is refused otherwise ends `failed`, as one where the plan cannot be written.
   */
  readonly finishConnect: (
    actor: Actor,
    provider: CalendarProvider,
    code: string,
    state: string,
  ) => Promise<Result<void, CalendarSignInFailure>>
  /** Signs out of the app here; its calendars there stay, and connecting again picks them up. */
  readonly disconnect: (actor: Actor, provider: CalendarProvider) => Promise<Result<CalendarStatus, PlanFailure>>
}

/** Waits for work whose caller does not, and reports its fault on stderr: nobody else would see it. */
async function quietly(work: Promise<unknown>): Promise<void> {
  try {
    await work
  } catch (err) {
    // oxlint-disable-next-line no-console -- stderr, never stdout: the MCP server's stdout carries the protocol
    console.error('Calendar sync failed:', err)
  }
}

function problemOf(connector: CalendarConnector, err: unknown): string {
  if (err instanceof CalendarAuthError && (err.reason === 'reconnect' || err.reason === 'client')) return err.reason
  const known = connector.problemOf(err)
  if (known) return known
  // `fetch` without a network, and a call that ran out of time.
  if (err instanceof Error && (err.message === 'fetch failed' || err.name === 'TimeoutError')) return 'offline'
  return err instanceof Error ? err.message : String(err)
}

/** A call that must work inside a round: its failure stops the round like an app's error does. */
function surely<T>(result: Result<T, PlanFailure>): T {
  if (!result.ok) throw new Error(failureMessage(result.error))
  return result.value
}

const signInFailureOf = (err: unknown): CalendarSignInFailure =>
  err instanceof CalendarAuthError && (err.reason === 'scope' || err.reason === 'client') ? err.reason : 'failed'

/**
 * The calendar sync over `ports`. `plans` is the service its rounds read and store the plan through: one that tells
 * no app of a save, since a round's own saves came from an app.
 */
export function createCalendarSyncService(ports: PlanPorts, plans: PlanService): CalendarSyncService {
  let tail: Promise<void> = Promise.resolve()

  /**
   * Runs `work` once everything queued here before it has finished, whether that worked or not. Work that writes the
   * sync state also holds the store's lock on it (`syncState.exclusive`), which another process waits for.
   */
  function exclusive<T>(work: () => Promise<T>): Promise<T> {
    const before = tail
    const next = (async () => {
      await before
      return work()
    })()
    tail = ended(next)
    return next
  }

  async function statusOf(place: PlanPlace, provider: CalendarProvider): Promise<CalendarStatus> {
    const sync = await ports.syncState.calendarSync(place.id, provider)
    const { configured, connectedAt } = await ports.calendarSignIn.status(provider)
    return {
      provider,
      writable: place.access === 'owner',
      configured,
      connectedAt,
      calendars: Object.keys(sync.calendars).length,
      events: Object.keys(sync.events).length,
      inbox: sync.inbox,
      lastRound: sync.lastRound ?? null,
      takenAt: sync.takenAt ?? null,
      error: sync.error ?? null,
    }
  }

  const planOf = async (actor: Actor): Promise<Plan> => surely(await plans.read(actor))

  function sessionOf(
    actor: Actor,
    place: PlanPlace,
    provider: CalendarProvider,
    sync: CalendarSync,
    plan: Plan,
  ): SyncSession {
    const connector = ports.connectors[provider]
    return {
      app: connector.adapter((renew) => ports.calendarTokens.token(place.owner, provider, renew), plan.meta.timezone),
      sync,
      plan: () => planOf(actor),
      take: async (changes) => {
        surely(await plans.apply(actor, changes, provider))
      },
      keep: () => ports.syncState.saveCalendarSync(place.id, provider, sync),
      now: () => ports.clock.now(),
    }
  }

  async function round(actor: Actor, provider: CalendarProvider): Promise<Result<CalendarStatus, PlanFailure>> {
    const place = await placeOf(ports, actor)
    if (!place.ok) return place
    const { id, access } = place.value
    if (access !== 'owner') return ok(await statusOf(place.value, provider))
    const { connectedAt } = await ports.calendarSignIn.status(provider)
    if (connectedAt === null) return ok(await statusOf(place.value, provider))
    await ports.syncState.exclusive(id, async () => {
      const sync = await ports.syncState.calendarSync(id, provider)
      try {
        const plan = await planOf(actor)
        await syncRound(sessionOf(actor, place.value, provider, sync, plan), plan)
        sync.error = undefined
      } catch (err) {
        sync.error = problemOf(ports.connectors[provider], err)
      }
      sync.lastRound = ports.clock.now()
      await ports.syncState.saveCalendarSync(id, provider, sync)
    })
    return ok(await statusOf(place.value, provider))
  }

  const waiting = new Map<string, Promise<Result<CalendarStatus, PlanFailure>>>()

  function requestRound(actor: Actor, provider: CalendarProvider): Promise<Result<CalendarStatus, PlanFailure>> {
    const key = `${actor.kind === 'person' ? actor.userId : ''}/${provider}`
    const queued =
      waiting.get(key) ??
      exclusive(() => {
        waiting.delete(key)
        return round(actor, provider)
      })
    waiting.set(key, queued)
    return queued
  }

  /** A decision on held edits, one at a time with the rounds, followed by a round that writes it. */
  async function decide(
    actor: Actor,
    provider: CalendarProvider,
    ids: readonly string[],
    how: typeof acceptProposals,
  ): Promise<Result<CalendarStatus, PlanFailure>> {
    const decided = await exclusive(async (): Promise<Result<void, PlanFailure>> => {
      const place = await ownPlace(ports, actor)
      if (!place.ok) return place
      const { id } = place.value
      await ports.syncState.exclusive(id, async () => {
        const kept = await ports.syncState.calendarSync(id, provider)
        const plan = await planOf(actor)
        await how(sessionOf(actor, place.value, provider, kept, plan), plan, ids)
        await ports.syncState.saveCalendarSync(id, provider, kept)
      })
      return ok(undefined)
    })
    return decided.ok ? requestRound(actor, provider) : decided
  }

  return {
    statuses: async (actor) => {
      const place = await placeOf(ports, actor)
      if (!place.ok) return place
      return ok(await Promise.all(CALENDAR_PROVIDERS.map((provider) => statusOf(place.value, provider))))
    },

    status: async (actor, provider) => {
      const place = await placeOf(ports, actor)
      return place.ok ? ok(await statusOf(place.value, provider)) : place
    },

    sync: requestRound,

    syncAll: async (actor) => {
      // Every app is asked at once, a connected one or not: a sync asked for right after the save then joins it.
      await Promise.all(CALENDAR_PROVIDERS.map((provider) => quietly(requestRound(actor, provider))))
    },

    accept: (actor, provider, ids) => decide(actor, provider, ids, acceptProposals),

    reject: (actor, provider, ids) => decide(actor, provider, ids, rejectProposals),

    saveClient: async (actor, provider, id, secret) => {
      const place = await ownPlace(ports, actor)
      if (!place.ok) return place
      await ports.calendarSignIn.saveClient(provider, id, secret)
      return ok(await statusOf(place.value, provider))
    },

    connectAddress: async (actor, provider, redirect) => {
      const place = await ownPlace(ports, actor)
      if (!place.ok) return place
      return ok(await ports.calendarSignIn.connectAddress(provider, redirect))
    },

    finishConnect: async (actor, provider, code, state) => {
      const place = await ownPlace(ports, actor)
      if (!place.ok) return fail('failed')
      try {
        await ports.calendarSignIn.finishConnect(provider, code, state)
      } catch (err) {
        return fail(signInFailureOf(err))
      }
      void quietly(requestRound(actor, provider))
      return ok(undefined)
    },

    disconnect: async (actor, provider) => {
      const place = await ownPlace(ports, actor)
      if (!place.ok) return place
      await ports.calendarSignIn.disconnect(provider)
      return ok(await statusOf(place.value, provider))
    },
  }
}
