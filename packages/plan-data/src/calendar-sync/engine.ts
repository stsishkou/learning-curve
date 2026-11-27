// Node-only: keeps the plan in the person's calendar apps. A round reads what changed in the app's calendars there,
// takes the person's edits into the plan as steps Undo takes back, holds the few that need a decision, then writes
// what the plan has and the app does not. Rounds and decisions run one at a time, whichever app they are for.
import { CALENDAR_PROVIDERS, parseLocal, toLocalString, type CalendarProvider, type Plan } from '@lc/plan-domain'
import {
  changeOf,
  fileProposals,
  parseCalendarSync,
  planPush,
  readRemote,
  rowOf,
  triage,
  writtenHash,
  writtenOf,
  type CalendarSync,
  type InboxItem,
  type Proposal,
  type RemoteEvent,
  type SyncCalendarRow,
  type Written,
} from '@lc/plan-domain/sync'

import { canWrite, readPlan, readSync, saveChanges, writeSync } from '../store'
import type { CalendarAdapter } from './kit'
import { accessToken, CalendarAuthError, calendarClient, connectedAt } from './oauth'
import { kitOf } from './providers'

/** Calls to an app in flight at once */
const LANES = 6

const readCalendarSync = (provider: CalendarProvider) => parseCalendarSync(readSync()[provider], kitOf(provider).idOf)
const writeCalendarSync = (provider: CalendarProvider, sync: CalendarSync) => writeSync(provider, sync)
const adapterOf = (provider: CalendarProvider, plan: Plan) =>
  kitOf(provider).adapter((renew) => accessToken(provider, renew), plan.meta.timezone)

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
 * What stopped the last round, in words the planner turns into advice: the sign-in ended, the client was refused,
 * access to the calendars was not granted, the app was out of reach; for Google, the Calendar API is off in the
 * person's Cloud project; for Outlook, the account has no mailbox Graph can reach.
 */
export type CalendarProblem = 'reconnect' | 'client' | 'scope' | 'offline' | 'api-off' | 'mailbox'

function problemOf(provider: CalendarProvider, err: unknown): string {
  if (err instanceof CalendarAuthError && (err.reason === 'reconnect' || err.reason === 'client')) return err.reason
  const known = kitOf(provider).problemOf(err)
  if (known) return known
  // `fetch` without a network, and a call that ran out of time.
  if (err instanceof Error && (err.message === 'fetch failed' || err.name === 'TimeoutError')) return 'offline'
  return err instanceof Error ? err.message : String(err)
}

export function calendarStatus(provider: CalendarProvider): CalendarStatus {
  const sync = readCalendarSync(provider)
  return {
    provider,
    writable: canWrite(),
    configured: calendarClient(provider) !== null,
    connectedAt: connectedAt(provider),
    calendars: Object.keys(sync.calendars).length,
    events: Object.keys(sync.events).length,
    inbox: sync.inbox,
    lastRound: sync.lastRound ?? null,
    takenAt: sync.takenAt ?? null,
    error: sync.error ?? null,
  }
}

export const calendarStatuses = (): CalendarStatus[] => CALENDAR_PROVIDERS.map(calendarStatus)

let tail: Promise<void> = Promise.resolve()

/** Runs `work` once everything queued before it has finished, whether that worked or not. */
function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const before = tail
  const next = (async () => {
    await before
    return work()
  })()
  tail = (async () => {
    try {
      await next
    } catch {
      // Reported to whoever queued it.
    }
  })()
  return next
}

const waiting = new Map<CalendarProvider, Promise<CalendarStatus>>()

/** One round of the sync with `provider`. A call while a round waits to start joins it; one while it runs gets the next. */
export function syncCalendar(provider: CalendarProvider): Promise<CalendarStatus> {
  const queued =
    waiting.get(provider) ??
    exclusive(() => {
      waiting.delete(provider)
      return round(provider)
    })
  waiting.set(provider, queued)
  return queued
}

/** A round with every app that is connected: the plan changed here, and each of them is sent the change. */
export const syncCalendars = (): Promise<CalendarStatus[]> =>
  Promise.all(CALENDAR_PROVIDERS.filter((provider) => connectedAt(provider) !== null).map(syncCalendar))

async function round(provider: CalendarProvider): Promise<CalendarStatus> {
  if (!canWrite() || connectedAt(provider) === null) return calendarStatus(provider)
  const sync = readCalendarSync(provider)
  try {
    const plan = readPlan()
    const app = adapterOf(provider, plan)
    const { found, advance } = await pull(app, plan, sync)
    const { take, hold } = triage(plan, sync, found)
    for (const source of new Set(found.map((p) => p.source))) {
      sync.inbox = fileProposals(
        sync.inbox,
        source,
        hold.filter((p) => p.source === source),
      )
    }
    await takeIn(provider, app, sync, take)
    advance()
    await push(provider, app, readPlan(), sync)
    sync.error = undefined
  } catch (err) {
    sync.error = problemOf(provider, err)
  }
  sync.lastRound = Date.now()
  writeCalendarSync(provider, sync)
  return calendarStatus(provider)
}

const without = <T>(record: Record<string, T>, keys: ReadonlySet<string>): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key)))

const dropRow = (sync: CalendarSync, uid: string) => {
  sync.events = without(sync.events, new Set([uid]))
}

/** Forgets a calendar in the app and what was written to it, so the next round makes it again. */
function forgetCalendar(sync: CalendarSync, calendar: string) {
  const id = sync.calendars[calendar]?.id
  const gone = new Set(Object.keys(sync.events).filter((uid) => sync.events[uid]?.calendar === id))
  sync.calendars = without(sync.calendars, new Set([calendar]))
  sync.events = without(sync.events, gone)
  sync.inbox = sync.inbox.filter((item) => !gone.has(item.uid))
}

/** Notes what one event read says (the app's own write, or something to put back) and returns the edits it makes. */
function absorb(sync: CalendarSync, plan: Plan, item: RemoteEvent): Proposal[] {
  const reading = readRemote(item, plan, sync)
  if (reading.kind === 'proposal') return reading.proposals
  if (reading.kind === 'seen' || reading.kind === 'reset') {
    const row = sync.events[reading.uid]
    if (row) row.etag = reading.etag
    if (row && reading.kind === 'reset') row.hash = ''
  }
  sync.inbox = fileProposals(sync.inbox, item.id, [])
  return []
}

/** Runs `work` on every item, a few at a time; after a failure nothing new starts, and the failure is thrown. */
async function lanes<T>(items: T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const failures: unknown[] = []
  const lane = async () => {
    for (let item = items.at(next++); item !== undefined && !failures.length; item = items.at(next++)) {
      try {
        // oxlint-disable-next-line no-await-in-loop -- a lane takes its items one after another
        await work(item)
      } catch (err) {
        failures.push(err)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(LANES, items.length) }, lane))
  const [failure] = failures
  if (failures.length) throw failure instanceof Error ? failure : new Error(String(failure))
}

/**
 * Reads each of the app's calendars and returns the edits made there, with `advance` to note where the reading ended
 * once they are stored: a round cut short before that reads the same changes again.
 */
async function pull(app: CalendarAdapter, plan: Plan, sync: CalendarSync) {
  const found: Proposal[] = []
  const ends: [SyncCalendarRow, string | undefined][] = []
  await lanes(Object.entries(sync.calendars), async ([calendar, row]) => {
    const read = await app.readCalendar(row, plan, sync)
    if (read === 'missing') {
      forgetCalendar(sync, calendar)
      return
    }
    for (const item of read.events) found.push(...absorb(sync, plan, item))
    ends.push([row, read.cursor])
  })
  const advance = () => {
    for (const [row, cursor] of ends) row.cursor = cursor
  }
  return { found, advance }
}

/**
 * Stores the app's edits in the plan, each a step Undo takes back; a session deleted there goes to the trash. A moved
 * repeat becomes an event of its own, written by the push: the copy left in the series goes.
 */
async function takeIn(provider: CalendarProvider, app: CalendarAdapter, sync: CalendarSync, items: Proposal[]) {
  if (!items.length) return
  saveChanges(items.map(changeOf), provider)
  sync.takenAt = Date.now()
  for (const item of items) {
    const row = sync.events[item.uid]
    if (item.change === null) dropRow(sync, item.uid)
    else if (row && !item.day) row.etag = item.etag
  }
  await lanes(items, async (item) => {
    const row = sync.events[item.uid]
    if (row && item.day && item.change?.type === 'event.detach') await app.deleteEvent(row.calendar, item.source)
  })
}

const frozen = (sync: CalendarSync) => new Set(sync.inbox.map((item) => item.uid))

/** Writes `written` over the event; when it changed in the app meanwhile, reads it and tries once more if it may. */
async function patch(
  app: CalendarAdapter,
  plan: Plan,
  sync: CalendarSync,
  uid: string,
  written: Written,
  retry = true,
): Promise<void> {
  const row = sync.events[uid]
  if (!row || frozen(sync).has(uid)) return
  const patched = await app.patchEvent(uid, row, written)
  if (patched === 'missing') dropRow(sync, uid)
  else if (patched !== 'conflict') sync.events[uid] = rowOf(written, row.calendar, patched.id, patched.etag)
  else {
    const fresh = await app.getEvent(uid, row)
    // An edit made meanwhile is read again by the next round, which takes it in.
    if (!fresh) dropRow(sync, uid)
    else absorb(sync, plan, fresh)
    if (fresh && retry) await patch(app, plan, sync, uid, written, false)
  }
}

async function push(provider: CalendarProvider, app: CalendarAdapter, plan: Plan, sync: CalendarSync) {
  await lanes(planPush(plan, sync, frozen(sync)).create, async (calendar) => {
    sync.calendars[calendar.id] = { id: await app.insertCalendar(calendar.name), summary: calendar.name }
    // At once: a calendar made in the account and then lost track of would stay there for good.
    writeCalendarSync(provider, sync)
  })
  const work = planPush(plan, sync, frozen(sync))
  await lanes(work.rename, async ({ id, summary }) => {
    await app.renameCalendar(id, summary)
    for (const row of Object.values(sync.calendars)) if (row.id === id) row.summary = summary
  })
  await lanes(work.move, async ({ uid, to, written }) => {
    const row = sync.events[uid]
    if (!row) return
    const moved = await app.moveEvent(uid, row, to, written)
    if (moved === 'missing') dropRow(sync, uid)
    else sync.events[uid] = { ...row, calendar: to, id: moved.id, etag: moved.etag }
  })
  await lanes(work.insert, async ({ uid, calendar, written }) => {
    const saved = await app.insertEvent(calendar, uid, written)
    sync.events[uid] = rowOf(written, calendar, saved.id, saved.etag)
  })
  await lanes(work.patch, ({ uid, written }) => patch(app, plan, sync, uid, written))
  await lanes(work.remove, async ({ uid, row }) => {
    await app.deleteEvent(row.calendar, row.id)
    dropRow(sync, uid)
  })
  await lanes(work.drop, async (calendar) => {
    const row = sync.calendars[calendar]
    if (row) await app.deleteCalendar(row.id)
    forgetCalendar(sync, calendar)
  })
}

const isCurrent = (plan: Plan, item: InboxItem) => {
  const event = plan.events.find((e) => e.uid === item.uid)
  return event !== undefined && writtenHash(writtenOf(event)) === item.basis
}

/**
 * Puts the plan's version back over a proposal. A repeat the app keeps on its own is restored, or deleted when the
 * plan skips that day; anything else is written again by the next round.
 */
const putBack = (app: CalendarAdapter, plan: Plan, sync: CalendarSync, items: InboxItem[]) =>
  lanes(items, async (item) => {
    const row = sync.events[item.uid]
    const event = plan.events.find((e) => e.uid === item.uid)
    if (!row) return
    if (!item.day) {
      if (item.change === null) dropRow(sync, item.uid)
      else Object.assign(row, { etag: item.etag, hash: '' })
    } else if (!event || event.skip?.includes(item.day)) {
      await app.deleteEvent(row.calendar, item.source)
    } else {
      const start = `${item.day}T${event.start.slice(11, 16)}`
      const end = toLocalString(parseLocal(start) + parseLocal(event.end) - parseLocal(event.start))
      if ((await app.restoreRepeat(row, item.source, { start, end })) === 'gone') dropRow(sync, item.uid)
    }
  })

/** Leaves the chosen items out of the inbox, and measures what is left for their events against the plan now. */
function settle(sync: CalendarSync, plan: Plan, chosen: InboxItem[]) {
  const ids = new Set(chosen.map((item) => item.id))
  const uids = new Set(chosen.map((item) => item.uid))
  sync.inbox = sync.inbox
    .filter((item) => !ids.has(item.id))
    .map((item) => {
      const event = uids.has(item.uid) ? plan.events.find((e) => e.uid === item.uid) : undefined
      return event ? { ...item, basis: writtenHash(writtenOf(event)) } : item
    })
}

/**
 * Takes the app's version of the chosen held edits into the plan, as a round does with the rest. One the plan has
 * moved past since it was read gets the plan's version instead.
 */
export async function acceptProposals(provider: CalendarProvider, ids: string[]): Promise<CalendarStatus> {
  await exclusive(async () => {
    const sync = readCalendarSync(provider)
    const plan = readPlan()
    const app = adapterOf(provider, plan)
    const chosen = sync.inbox.filter((item) => ids.includes(item.id))
    const taken = chosen.filter((item) => isCurrent(plan, item))
    await takeIn(provider, app, sync, taken)
    await putBack(
      app,
      plan,
      sync,
      chosen.filter((item) => !taken.includes(item)),
    )
    settle(sync, readPlan(), chosen)
    writeCalendarSync(provider, sync)
  })
  return syncCalendar(provider)
}

/** Keeps the plan's version of the chosen proposals, written over the edit in the app. */
export async function rejectProposals(provider: CalendarProvider, ids: string[]): Promise<CalendarStatus> {
  await exclusive(async () => {
    const sync = readCalendarSync(provider)
    const plan = readPlan()
    const chosen = sync.inbox.filter((item) => ids.includes(item.id))
    await putBack(adapterOf(provider, plan), plan, sync, chosen)
    settle(sync, plan, chosen)
    writeCalendarSync(provider, sync)
  })
  return syncCalendar(provider)
}
