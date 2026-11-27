import { expect, test } from 'vitest'

import { applyChange } from '../core/changes'
import { applyEdits, emptyEdits } from '../core/edits'
import { isSession } from '../core/progress'
import type { Plan } from '../core/types'
import { fixturePlan, itemAt } from '../fixtures'
import {
  fileProposals,
  parseCalendarSync,
  planPush,
  readRemote,
  rowOf,
  triage,
  writtenHash,
  writtenOf,
  type Proposal,
  type RemoteEvent,
  type SyncState,
} from './calendar-sync'

const session = itemAt(fixturePlan.events.filter((e) => isSession(e) && !e.done))
const repeat = itemAt(fixturePlan.events.filter((e) => e.rrule))

/** Every calendar and event written to a calendar app as the plan has them now. */
function synced(plan: Plan): SyncState {
  const state: SyncState = { calendars: {}, events: {} }
  for (const c of plan.calendars) state.calendars[c.id] = { id: `c-${c.id}`, summary: c.name }
  for (const e of plan.events) state.events[e.uid] = rowOf(writtenOf(e), `c-${e.calendar}`, `id-${e.uid}`, `v-${e.uid}`)
  return state
}
const changed = (plan: Plan, ...changes: Parameters<typeof applyChange>[2][]) => {
  let edits = emptyEdits()
  for (const change of changes) edits = applyChange(plan, edits, change)
  return applyEdits(plan, edits).plan
}
/** The event as the app would return it after it was written, with a person's edit on top. */
const remote = (uid: string, edit: Partial<RemoteEvent> = {}): RemoteEvent => {
  const written = writtenOf(itemAt(fixturePlan.events.filter((e) => e.uid === uid)))
  const { summary, start, end } = written
  return { id: `id-${uid}`, uid, etag: 'edited', cancelled: false, summary, start, end, ...edit }
}

test('a skipped session is written as free time, without the ✓ of a done one', () => {
  const written = writtenOf({ ...session, done: true, skipped: true })
  expect(written.summary).toBe(session.title)
  expect(written.free).toBe(true)
})

test('a done session is written with ✓, as free time, with how long it took first in its notes', () => {
  const written = writtenOf({ ...session, done: true, actual: 75 })
  expect(written.summary).toBe(`✓ ${session.title}`)
  expect(written.free).toBe(true)
  expect(written.description.startsWith('✓ 1:15 / ')).toBe(true)
  expect(written).toMatchObject({ start: session.start, end: session.end, allDay: false })
  expect(writtenOf(repeat).repeat).toEqual({ rule: repeat.rrule, skip: repeat.skip ?? [] })
})

test('the first round writes every calendar and event; a plan in step writes nothing', () => {
  const first = planPush(fixturePlan, { calendars: {}, events: {} })
  expect(first.create).toHaveLength(fixturePlan.calendars.length)
  expect(first.insert).toHaveLength(0)
  const state = synced(fixturePlan)
  expect(planPush(fixturePlan, state)).toEqual({
    create: [],
    rename: [],
    insert: [],
    move: [],
    patch: [],
    remove: [],
    drop: [],
  })
  const { calendars } = state
  expect(planPush(fixturePlan, { calendars, events: {} }).insert).toHaveLength(fixturePlan.events.length)
})

test('a change in the plan writes only what it touched, and a waiting proposal holds its event back', () => {
  const state = synced(fixturePlan)
  const moved = changed(fixturePlan, {
    type: 'event.patch',
    uid: session.uid,
    patch: { start: `${session.start.slice(0, 11)}06:00`, end: `${session.start.slice(0, 11)}07:00` },
  })
  const push = planPush(moved, state)
  expect(push.patch.map((p) => p.uid)).toEqual([session.uid])
  expect(push.patch[0]?.written.start).toBe(`${session.start.slice(0, 11)}06:00`)
  expect(planPush(moved, state, new Set([session.uid])).patch).toEqual([])

  const removed = changed(fixturePlan, { type: 'event.remove', uid: session.uid })
  expect(planPush(removed, state).remove).toEqual([{ uid: session.uid, row: state.events[session.uid] }])
  const elsewhere = itemAt(fixturePlan.calendars.filter((c) => c.id !== session.calendar))
  const recalendared = changed(fixturePlan, {
    type: 'event.patch',
    uid: session.uid,
    patch: { calendar: elsewhere.id },
  })
  expect(planPush(recalendared, state).move).toMatchObject([{ uid: session.uid, to: `c-${elsewhere.id}` }])
})

test('the app reading back its own write proposes nothing', () => {
  const state = synced(fixturePlan)
  const own = remote(session.uid, { etag: `v-${session.uid}` })
  expect(readRemote(own, fixturePlan, state)).toEqual({ kind: 'seen', uid: session.uid, etag: own.etag })
  expect(readRemote(remote(session.uid), fixturePlan, state).kind).toBe('seen')
  expect(readRemote({ ...remote(session.uid), uid: null }, fixturePlan, state)).toEqual({ kind: 'none' })
})

test('a ✓ typed in the app proposes done, and a move proposes the new slot', () => {
  const state = synced(fixturePlan)
  const ticked = readRemote(remote(session.uid, { summary: `✓ ${session.title}` }), fixturePlan, state)
  expect(ticked).toMatchObject({
    kind: 'proposal',
    proposals: [{ uid: session.uid, change: { type: 'events.done', uids: [session.uid], done: true }, etag: 'edited' }],
  })
  const day = session.start.slice(0, 10)
  const moved = readRemote(remote(session.uid, { start: `${day}T06:00`, end: `${day}T07:30` }), fixturePlan, state)
  expect(moved).toMatchObject({
    kind: 'proposal',
    proposals: [
      { change: { type: 'event.patch', uid: session.uid, patch: { start: `${day}T06:00`, end: `${day}T07:30` } } },
    ],
  })
  if (moved.kind === 'proposal') expect(moved.proposals[0]?.basis).toBe(writtenHash(writtenOf(session)))
})

test('a title edited in the app renames the session; a cleared one is written back; deletions are read', () => {
  const state = synced(fixturePlan)
  expect(readRemote(remote(session.uid, { summary: '✓ Something else ' }), fixturePlan, state)).toMatchObject({
    kind: 'proposal',
    proposals: [
      { change: { type: 'events.done', done: true } },
      { change: { type: 'event.patch', uid: session.uid, patch: { title: 'Something else' } } },
    ],
  })
  expect(readRemote(remote(session.uid, { summary: '' }), fixturePlan, state).kind).toBe('reset')
  expect(readRemote(remote(session.uid, { cancelled: true }), fixturePlan, state)).toMatchObject({
    kind: 'proposal',
    proposals: [{ uid: session.uid, change: null }],
  })
  const day = '2026-12-08'
  const cancelled = remote(repeat.uid, { id: 'one-repeat', cancelled: true, day })
  expect(readRemote(cancelled, fixturePlan, state)).toMatchObject({
    kind: 'proposal',
    proposals: [{ change: { type: 'event.patch', uid: repeat.uid, patch: { skip: [...(repeat.skip ?? []), day] } } }],
  })
  const slot = `${day}T${repeat.start.slice(11, 16)}`
  expect(readRemote({ ...cancelled, cancelled: false, start: slot }, fixturePlan, state)).toEqual({ kind: 'none' })
  expect(
    readRemote({ ...cancelled, cancelled: false, start: `${day}T06:00`, end: `${day}T07:00` }, fixturePlan, state),
  ).toMatchObject({ proposals: [{ change: { type: 'event.detach', uid: repeat.uid, day, start: `${day}T06:00` } }] })
})

test('a calendar gone from the plan is dropped; a new reading of an event replaces what it proposed', () => {
  const state = synced(fixturePlan)
  const gone = itemAt(fixturePlan.calendars)
  const without = { ...fixturePlan, calendars: fixturePlan.calendars.filter((c) => c.id !== gone.id) }
  expect(planPush(without, state).drop).toEqual([gone.id])

  const ticked = readRemote(remote(session.uid, { summary: `✓ ${session.title}` }), fixturePlan, state)
  const proposals = ticked.kind === 'proposal' ? ticked.proposals : []
  const source = `id-${session.uid}`
  const inbox = fileProposals([], source, proposals)
  expect(inbox).toHaveLength(1)
  expect(inbox[0]?.source).toBe(source)
  expect(fileProposals(inbox, source, [])).toEqual([])
  expect(fileProposals(inbox, 'other', [])).toEqual(inbox)
})

test('the stored state is read back, rows of the time before ids were kept included', () => {
  const state = synced(fixturePlan)
  const inbox = fileProposals([], 'x', [])
  const stored = structuredClone({ ...state, inbox, lastRound: 5, junk: 1 })
  expect(parseCalendarSync(stored)).toEqual({ ...state, inbox, lastRound: 5, error: undefined })
  expect(parseCalendarSync(null)).toEqual({ calendars: {}, events: {}, inbox: [] })

  const { id: _id, ...old } = rowOf(writtenOf(session), 'c', 'id', 'v')
  const before = { calendars: { a: { id: 'c', summary: 'A', syncToken: 't' } }, events: { [session.uid]: old } }
  expect(parseCalendarSync(before, (uid) => `made-${uid}`)).toMatchObject({
    calendars: { a: { cursor: 't' } },
    events: { [session.uid]: { id: `made-${session.uid}` } },
  })
  expect(parseCalendarSync(before).events).toEqual({})
})

/** What reading `edit` of the session in the app proposes. */
const proposed = (edit: Partial<RemoteEvent>, state = synced(fixturePlan)): Proposal[] => {
  const reading = readRemote(remote(session.uid, edit), fixturePlan, state)
  return reading.kind === 'proposal' ? reading.proposals : []
}

test('an edit made in the app is taken unless the planner changed the same thing since it was written', () => {
  const day = session.start.slice(0, 10)
  const move = { start: `${day}T06:00`, end: `${day}T07:00` }
  const tick = { summary: `✓ ${session.title}` }
  expect(triage(fixturePlan, synced(fixturePlan), proposed(move))).toMatchObject({ take: [{}], hold: [] })

  // The planner renamed the session since it was written: a move in the app does not touch the title.
  const renamed = changed(fixturePlan, { type: 'event.patch', uid: session.uid, patch: { title: 'Renamed' } })
  const state = synced(fixturePlan)
  expect(triage(renamed, state, proposed(move, state)).take).toHaveLength(1)
  expect(triage(renamed, state, proposed(tick, state)).take).toHaveLength(1)
  expect(triage(renamed, state, proposed({ summary: 'Other' }, state)).hold).toMatchObject([{ hold: 'both' }])

  // The planner moved it too: the app's move waits, and so does a deletion of what the planner changed.
  const later = { start: session.start.replace(/T\d\d/, 'T20'), end: session.end.replace(/T\d\d/, 'T21') }
  const moved = changed(fixturePlan, { type: 'event.patch', uid: session.uid, patch: later })
  expect(triage(moved, state, proposed(move, state)).hold).toMatchObject([{ hold: 'both' }])
  expect(triage(moved, state, proposed({ cancelled: true }, state)).hold).toHaveLength(1)
  expect(triage(fixturePlan, state, proposed({ cancelled: true }, state)).take).toHaveLength(1)

  // One the plan cannot take waits too.
  const backwards = { start: `${day}T08:00`, end: `${day}T07:00` }
  expect(triage(fixturePlan, state, proposed(backwards, state)).hold).toMatchObject([{ hold: 'misfit' }])
})
