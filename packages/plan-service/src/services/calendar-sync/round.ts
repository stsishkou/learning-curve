import type { Plan, PlanChange } from '@lc/plan-domain'
import {
  changeOf,
  fileProposals,
  planPush,
  readRemote,
  rowOf,
  triage,
  type CalendarSync,
  type Proposal,
  type RemoteEvent,
  type SyncCalendarRow,
  type Written,
} from '@lc/plan-domain/sync'

import type { CalendarAdapter } from '../../ports'
import { lanes } from './lanes'

/**
 * A round's or a decision's hold on one calendar app: its calls, what it was last given of the plan, and the plan's
 * store. `sync` is changed in place as the work goes; whoever opened the session keeps it at the end.
 */
export interface SyncSession {
  readonly app: CalendarAdapter
  readonly sync: CalendarSync
  /** The plan as stored now */
  readonly plan: () => Promise<Plan>
  /** Stores edits made in the app, each a step of the history from the app; no app is sent them again */
  readonly take: (changes: readonly PlanChange[]) => Promise<void>
  /** Keeps `sync` as it is now, before the work ends */
  readonly keep: () => Promise<void>
  readonly now: () => number
}

const without = <T>(record: Record<string, T>, keys: ReadonlySet<string>): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key)))

/** Forgets what was written to the event `uid`, so the next round writes it again. */
export const dropRow = (sync: CalendarSync, uid: string) => {
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
export async function takeIn(session: SyncSession, items: Proposal[]): Promise<void> {
  if (!items.length) return
  const { app, sync } = session
  await session.take(items.map(changeOf))
  sync.takenAt = session.now()
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

async function push(session: SyncSession, plan: Plan) {
  const { app, sync } = session
  await lanes(planPush(plan, sync, frozen(sync)).create, async (calendar) => {
    sync.calendars[calendar.id] = { id: await app.insertCalendar(calendar.name), summary: calendar.name }
    // At once: a calendar made in the account and then lost track of would stay there for good.
    await session.keep()
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

/**
 * One round over `plan` as it was when the round began: reads what changed in the app's calendars, takes the
 * person's edits there into the plan, files the few that need a decision, then writes what the plan now has and the
 * app does not. Throws what stopped it; what was done until then stays in `session.sync`.
 */
export async function syncRound(session: SyncSession, plan: Plan): Promise<void> {
  const { app, sync } = session
  const { found, advance } = await pull(app, plan, sync)
  const { take, hold } = triage(plan, sync, found)
  for (const source of new Set(found.map((p) => p.source))) {
    sync.inbox = fileProposals(
      sync.inbox,
      source,
      hold.filter((p) => p.source === source),
    )
  }
  await takeIn(session, take)
  advance()
  await push(session, await session.plan())
}
