import { isSession, type CalendarProvider, type PlanChange, type PlanEvent } from '@lc/plan-domain'
import { fixtureBase, itemAt } from '@lc/plan-domain/fixtures'
import type { RemoteEvent, Written } from '@lc/plan-domain/sync'
import { expect, test } from 'vitest'

import { LOCAL_ACTOR } from '../../actor'
import {
  CalendarAuthError,
  type CalendarAdapter,
  type CalendarConnector,
  type CalendarSignIn,
  type PlanPorts,
  type Saved,
} from '../../ports'
import { fail, ok, type Result } from '../../result'
import { createMemoryPorts, type MemoryPortsOptions } from '../../testing'
import { createPlanServices } from '../create'

const actor = LOCAL_ACTOR

function value<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error(`The call failed: ${JSON.stringify(result.error)}`)
  return result.value
}

/** Lets every round a save started in the background end: memory ports answer within the same tick. */
const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

const nothing = () => undefined

function deferred() {
  let resolve: () => void = nothing
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

/**
 * A calendar app in memory: what the sync wrote there, read back whole on every round, and edits a person makes
 * there. `sessions` counts the rounds and decisions that opened it.
 */
function memoryApp(provider: CalendarProvider) {
  const calendars = new Map<string, string>()
  const events = new Map<string, { readonly calendar: string; readonly item: RemoteEvent }>()
  let version = 0
  let failure: Error | null = null
  let gate: Promise<void> | null = null
  const reached = deferred()
  const app = { sessions: 0 }

  const write = (calendar: string, uid: string, written: Written): Saved => {
    version += 1
    const { summary, start, end } = written
    const item: RemoteEvent = { id: uid, uid, etag: `v${version}`, cancelled: false, summary, start, end }
    events.set(uid, { calendar, item })
    return { id: uid, etag: item.etag }
  }

  const answer = <T>(work: () => T): Promise<T> => (failure ? Promise.reject(failure) : Promise.resolve(work()))

  const adapter: CalendarAdapter = {
    insertCalendar: (name) =>
      answer(() => {
        const id = `calendar-${calendars.size + 1}`
        calendars.set(id, name)
        return id
      }),
    renameCalendar: (id, name) => answer(() => void calendars.set(id, name)),
    deleteCalendar: (id) => answer(() => void calendars.delete(id)),
    readCalendar: async (row) => {
      if (gate) {
        reached.resolve()
        await gate
      }
      return answer(() =>
        calendars.has(row.id)
          ? { events: [...events.values()].filter((e) => e.calendar === row.id).map((e) => e.item) }
          : 'missing',
      )
    },
    getEvent: (uid) => answer(() => events.get(uid)?.item ?? null),
    insertEvent: (calendar, uid, written) => answer(() => write(calendar, uid, written)),
    patchEvent: (uid, row, written) =>
      answer(() => {
        const now = events.get(uid)
        if (!now) return 'missing'
        return now.item.etag === row.etag ? write(row.calendar, uid, written) : 'conflict'
      }),
    moveEvent: (uid, _row, to, written) => answer(() => write(to, uid, written)),
    deleteEvent: (_calendar, id) => answer(() => void events.delete(id)),
    restoreRepeat: () => answer(() => 'done'),
  }

  const connector: CalendarConnector = {
    provider,
    auth: {
      authorize: 'https://app.example/authorize',
      token: '',
      scope: '',
      page: {},
      scopeOnToken: false,
      granted: () => true,
    },
    adapter: () => {
      app.sessions += 1
      return adapter
    },
    problemOf: (err) => (err instanceof Error && err.message === 'API off' ? 'api-off' : null),
  }

  return Object.assign(app, {
    connector,
    /** The event `uid` as the app has it now */
    event: (uid: string) => events.get(uid)?.item,
    /** A person's edit made in the app */
    edit: (uid: string, change: Partial<RemoteEvent>) => {
      const stored = events.get(uid)
      if (!stored) throw new Error(`No event ${uid}`)
      version += 1
      events.set(uid, { ...stored, item: { ...stored.item, ...change, etag: `v${version}` } })
    },
    /** Every call fails with `err` from now on, as when the app refuses or cannot be reached */
    failWith: (err: Error) => {
      failure = err
    },
    /** Holds every read of a calendar until `release` is called; `reached` resolves when one waits */
    pause: () => {
      const held = deferred()
      gate = held.promise
      return { reached: reached.promise, release: held.resolve }
    },
  })
}

const SIGN_IN_ENDS: Readonly<Record<string, Error>> = {
  scope: new CalendarAuthError('scope'),
  client: new CalendarAuthError('client'),
  state: new CalendarAuthError('state'),
  offline: new TypeError('fetch failed'),
}

/** A host account connected to Google only; a sign-in finishes with the code `ok`, any other names its failure. */
const signIn: CalendarSignIn = {
  status: (provider) => Promise.resolve({ configured: true, connectedAt: provider === 'google' ? 1 : null }),
  saveClient: () => Promise.resolve(),
  connectAddress: () => Promise.resolve('https://app.example/authorize?state=s'),
  finishConnect: (_provider, code) => {
    const failure = SIGN_IN_ENDS[code]
    return failure ? Promise.reject(failure) : Promise.resolve()
  },
  disconnect: () => Promise.resolve(),
}

function connected(options: MemoryPortsOptions = {}) {
  const memory = createMemoryPorts(options)
  const app = memoryApp('google')
  const ports: PlanPorts = {
    ...memory,
    connectors: { ...memory.connectors, google: app.connector },
    calendarSignIn: signIn,
    calendarTokens: { token: () => Promise.resolve('token') },
  }
  return { app, ports, ...createPlanServices(ports) }
}

const sessions = fixtureBase.events.filter((e) => isSession(e) && !e.rrule && !e.done)
const retitle = (event: PlanEvent, title: string): PlanChange => ({
  type: 'event.patch',
  uid: event.uid,
  patch: { title },
})

test('a save is sent to every connected app; what a round takes in from an app starts no round of its own', async () => {
  const { app, plans, calendars } = connected()
  const first = value(await calendars.sync(actor, 'google'))
  expect(first).toMatchObject({ error: null, writable: true, events: fixtureBase.events.length })

  const session = itemAt(sessions)
  app.edit(session.uid, { summary: 'Taken in' })
  const opened = app.sessions
  expect(value(await calendars.sync(actor, 'google')).takenAt).toBeTypeOf('number')
  await settled()
  expect(app.sessions).toBe(opened + 1)
  const plan = value(await plans.read(actor))
  expect(plan.events.find((e) => e.uid === session.uid)).toMatchObject({ title: 'Taken in' })

  value(await plans.apply(actor, [retitle(session, 'From the planner')]))
  await settled()
  expect(app.sessions).toBe(opened + 2)
  expect(app.event(session.uid)).toMatchObject({ summary: 'From the planner' })
})

test('syncAll never rejects, so a save can start it without waiting', async () => {
  const { calendars } = createPlanServices(createMemoryPorts())
  await expect(calendars.sync(actor, 'google')).rejects.toThrow('No calendar apps in memory')
  await expect(calendars.syncAll(actor)).resolves.toBeUndefined()
})

test('a call while a round waits joins it; one while it runs gets the next', async () => {
  const { app, calendars } = connected()
  value(await calendars.sync(actor, 'google'))
  const before = app.sessions
  const { reached, release } = app.pause()
  const running = calendars.sync(actor, 'google')
  await reached
  const next = calendars.sync(actor, 'google')
  expect(next).not.toBe(running)
  expect(calendars.sync(actor, 'google')).toBe(next)
  release()
  await Promise.all([running, next])
  expect(app.sessions).toBe(before + 2)
})

test('an edit made both in the app and in the planner waits; reject writes the plan back, accept takes the app', async () => {
  const { app, plans, calendars } = connected()
  value(await calendars.sync(actor, 'google'))
  const [kept, taken] = [itemAt(sessions, 1), itemAt(sessions, 2)]
  app.edit(kept.uid, { summary: 'App kept' })
  app.edit(taken.uid, { summary: 'App taken' })
  value(await plans.apply(actor, [retitle(kept, 'Plan kept'), retitle(taken, 'Plan taken')]))
  const round = value(await calendars.sync(actor, 'google'))
  expect(round.inbox).toHaveLength(2)
  expect(Object.fromEntries(round.inbox.map((item) => [item.uid, item.hold]))).toEqual({
    [kept.uid]: 'both',
    [taken.uid]: 'both',
  })
  const of = (event: PlanEvent) => round.inbox.filter((item) => item.uid === event.uid).map((item) => item.id)

  expect(value(await calendars.reject(actor, 'google', of(kept))).inbox).toHaveLength(1)
  expect(app.event(kept.uid)).toMatchObject({ summary: 'Plan kept' })
  expect(value(await calendars.accept(actor, 'google', of(taken))).inbox).toEqual([])
  const plan = value(await plans.read(actor))
  expect(plan.events.find((e) => e.uid === taken.uid)).toMatchObject({ title: 'App taken' })
  expect(app.event(taken.uid)).toMatchObject({ summary: 'App taken' })
})

test.each([
  [new CalendarAuthError('reconnect'), 'reconnect'],
  [new CalendarAuthError('client'), 'client'],
  [new Error('API off'), 'api-off'],
  [new TypeError('fetch failed'), 'offline'],
  [Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }), 'offline'],
  [new Error('Something else'), 'Something else'],
])('a round stopped by %s keeps the problem %j', async (err, problem) => {
  const { app, calendars } = connected()
  app.failWith(err)
  expect(value(await calendars.sync(actor, 'google'))).toMatchObject({ error: problem })
  expect(value(await calendars.status(actor, 'google')).lastRound).toBeTypeOf('number')
})

test('finishing a sign-in names how it ended, and an app connected so gets its first round', async () => {
  const { app, calendars } = connected()
  expect(await calendars.finishConnect(actor, 'google', 'scope', 's')).toEqual(fail('scope'))
  expect(await calendars.finishConnect(actor, 'google', 'client', 's')).toEqual(fail('client'))
  expect(await calendars.finishConnect(actor, 'google', 'state', 's')).toEqual(fail('failed'))
  expect(await calendars.finishConnect(actor, 'google', 'offline', 's')).toEqual(fail('failed'))
  await settled()
  expect(app.sessions).toBe(0)

  expect(await calendars.finishConnect(actor, 'google', 'ok', 's')).toEqual(ok(undefined))
  await settled()
  expect(app.sessions).toBe(1)
})

test('statuses tell each app apart: configured, connected, and what the plan holds there', async () => {
  const { calendars } = connected()
  value(await calendars.sync(actor, 'google'))
  const [google, outlook] = value(await calendars.statuses(actor))
  expect(google).toMatchObject({ provider: 'google', configured: true, connectedAt: 1, writable: true })
  expect(google?.calendars).toBe(fixtureBase.calendars.length)
  expect(outlook).toEqual({
    provider: 'outlook',
    writable: true,
    configured: true,
    connectedAt: null,
    calendars: 0,
    events: 0,
    inbox: [],
    lastRound: null,
    takenAt: null,
    error: null,
  })
  expect(value(await calendars.saveClient(actor, 'outlook', 'id', 'secret'))).toEqual(outlook)
  expect(value(await calendars.connectAddress(actor, 'outlook', 'http://localhost/cb'))).toBe(
    'https://app.example/authorize?state=s',
  )
  expect(value(await calendars.disconnect(actor, 'outlook'))).toEqual(outlook)
})

const refuse = () => Promise.reject(new Error('A write on a read-only host'))

test('on a read-only host no round runs, nothing is written, and every change of sign-in is forbidden', async () => {
  const { app, ports } = connected({ writable: false })
  const { calendars } = createPlanServices({
    ...ports,
    plans: { ...ports.plans, save: refuse },
    syncState: { ...ports.syncState, saveFeedRevisions: refuse, saveCalendarSync: refuse },
    calendarSignIn: {
      ...signIn,
      saveClient: refuse,
      connectAddress: refuse,
      finishConnect: refuse,
      disconnect: refuse,
    },
    calendarTokens: { token: refuse },
  })
  const forbidden = fail({ kind: 'forbidden' })

  const statuses = value(await calendars.statuses(actor))
  expect(statuses.map((s) => [s.provider, s.writable])).toEqual([
    ['google', false],
    ['outlook', false],
  ])
  expect(await calendars.sync(actor, 'google')).toMatchObject({ ok: true, value: { lastRound: null } })
  await calendars.syncAll(actor)
  expect(await calendars.accept(actor, 'google', ['a'])).toEqual(forbidden)
  expect(await calendars.reject(actor, 'google', ['a'])).toEqual(forbidden)
  expect(await calendars.saveClient(actor, 'google', 'id', 'secret')).toEqual(forbidden)
  expect(await calendars.connectAddress(actor, 'google', 'http://localhost/cb')).toEqual(forbidden)
  expect(await calendars.disconnect(actor, 'google')).toEqual(forbidden)
  expect(await calendars.finishConnect(actor, 'google', 'ok', 's')).toEqual(fail('failed'))
  expect(app.sessions).toBe(0)
})
