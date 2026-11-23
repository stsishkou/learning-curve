import { expect, test } from 'vitest'

import { applyChange } from './changes'
import { applyEdits, emptyEdits } from './edits'
import { fixturePlan, itemAt } from './fixtures'
import {
  bodyHash,
  fileProposals,
  googleBody,
  googleEventId,
  parseGoogleSync,
  planPush,
  readGoogleEvent,
  rowOf,
  triage,
  uidOfGoogleId,
  wallOf,
  type GoogleEvent,
  type GoogleState,
  type Proposal,
} from './google-sync'
import { isSession } from './progress'
import type { Plan } from './types'

const TZ = fixturePlan.meta.timezone
const session = itemAt(fixturePlan.events.filter((e) => isSession(e) && !e.done))
const repeat = itemAt(fixturePlan.events.filter((e) => e.rrule))

/** Every calendar and event written to Google as the plan has them now. */
function synced(plan: Plan): GoogleState {
  const state: GoogleState = { calendars: {}, events: {} }
  for (const c of plan.calendars) state.calendars[c.id] = { id: `g-${c.id}`, summary: c.name }
  for (const e of plan.events) state.events[e.uid] = rowOf(googleBody(e, TZ), `g-${e.calendar}`, `"etag-${e.uid}"`)
  return state
}
const changed = (plan: Plan, ...changes: Parameters<typeof applyChange>[2][]) => {
  let edits = emptyEdits()
  for (const change of changes) edits = applyChange(plan, edits, change)
  return applyEdits(plan, edits).plan
}
/** The event as Google would return it after the app wrote it, with a person's edit on top. */
const inGoogle = (uid: string, edit: Partial<GoogleEvent> = {}): GoogleEvent => {
  const event = itemAt(fixturePlan.events.filter((e) => e.uid === uid))
  return { ...googleBody(event, TZ), etag: '"edited"', status: 'confirmed', ...edit }
}

test('an event id is the uid in base32hex, and goes back to it', () => {
  expect(googleEventId('certs-001@learning-curve')).toBe('cdin4t3j5ko30ca0dhim2sjed5n6ebb3elp7cp8')
  for (const e of fixturePlan.events) {
    const id = googleEventId(e.uid)
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/)
    expect(uidOfGoogleId(id)).toBe(e.uid)
  }
  expect(uidOfGoogleId('Abc_20261201T110000Z')).toBeNull()
})

test('a done session is written with ✓, as free time, with how long it took first in its notes', () => {
  const body = googleBody({ ...session, done: true, actual: 75 }, TZ)
  expect(body.summary).toBe(`✓ ${session.title}`)
  expect(body.transparency).toBe('transparent')
  expect(body.description.startsWith('✓ 1:15 / ')).toBe(true)
  expect(body.start).toEqual({ dateTime: `${session.start}:00`, timeZone: TZ })
  expect(googleBody(repeat, TZ).recurrence?.[0]).toBe(`RRULE:${repeat.rrule}`)
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
  expect(push.patch[0]?.etag).toBe(`"etag-${session.uid}"`)
  expect(planPush(moved, state, new Set([session.uid])).patch).toEqual([])

  const removed = changed(fixturePlan, { type: 'event.remove', uid: session.uid })
  expect(planPush(removed, state).remove).toEqual([
    { uid: session.uid, calendar: `g-${session.calendar}`, etag: `"etag-${session.uid}"` },
  ])
  const elsewhere = itemAt(fixturePlan.calendars.filter((c) => c.id !== session.calendar))
  const recalendared = changed(fixturePlan, {
    type: 'event.patch',
    uid: session.uid,
    patch: { calendar: elsewhere.id },
  })
  expect(planPush(recalendared, state).move).toEqual([
    { uid: session.uid, from: `g-${session.calendar}`, to: `g-${elsewhere.id}` },
  ])
})

test('the app reading back its own write proposes nothing', () => {
  const state = synced(fixturePlan)
  const own = { ...inGoogle(session.uid), etag: `"etag-${session.uid}"` }
  expect(readGoogleEvent(own, fixturePlan, state)).toEqual({ kind: 'seen', uid: session.uid, etag: own.etag })
  expect(readGoogleEvent(inGoogle(session.uid), fixturePlan, state).kind).toBe('seen')
})

test('a ✓ typed in Google proposes done, and a move proposes the new slot', () => {
  const state = synced(fixturePlan)
  const ticked = readGoogleEvent(inGoogle(session.uid, { summary: `✓ ${session.title}` }), fixturePlan, state)
  expect(ticked).toMatchObject({
    kind: 'proposal',
    proposals: [
      { uid: session.uid, change: { type: 'events.done', uids: [session.uid], done: true }, etag: '"edited"' },
    ],
  })
  const day = session.start.slice(0, 10)
  const moved = readGoogleEvent(
    inGoogle(session.uid, { start: { dateTime: `${day}T06:00:00+03:00` }, end: { dateTime: `${day}T07:30:00+03:00` } }),
    fixturePlan,
    state,
  )
  expect(moved).toMatchObject({
    kind: 'proposal',
    proposals: [
      { change: { type: 'event.patch', uid: session.uid, patch: { start: `${day}T06:00`, end: `${day}T07:30` } } },
    ],
  })
  if (moved.kind === 'proposal') expect(moved.proposals[0]?.basis).toBe(bodyHash(googleBody(session, TZ)))
})

test('a title edited in Google renames the session; a cleared one is written back; deletions are read', () => {
  const state = synced(fixturePlan)
  expect(readGoogleEvent(inGoogle(session.uid, { summary: '✓ Something else ' }), fixturePlan, state)).toMatchObject({
    kind: 'proposal',
    proposals: [
      { change: { type: 'events.done', done: true } },
      { change: { type: 'event.patch', uid: session.uid, patch: { title: 'Something else' } } },
    ],
  })
  expect(readGoogleEvent(inGoogle(session.uid, { summary: '' }), fixturePlan, state).kind).toBe('reset')
  expect(readGoogleEvent(inGoogle(session.uid, { status: 'cancelled' }), fixturePlan, state)).toMatchObject({
    kind: 'proposal',
    proposals: [{ uid: session.uid, change: null }],
  })
  const day = '2026-12-08'
  const cancelled: GoogleEvent = {
    id: `${googleEventId(repeat.uid)}_20261208T150000Z`,
    etag: '"x"',
    status: 'cancelled',
    recurringEventId: googleEventId(repeat.uid),
    originalStartTime: { dateTime: `${day}T${repeat.start.slice(11, 16)}:00+03:00` },
  }
  expect(readGoogleEvent(cancelled, fixturePlan, state)).toMatchObject({
    kind: 'proposal',
    proposals: [{ change: { type: 'event.patch', uid: repeat.uid, patch: { skip: [...(repeat.skip ?? []), day] } } }],
  })
  expect(readGoogleEvent({ ...cancelled, status: 'confirmed' }, fixturePlan, state)).toEqual({ kind: 'none' })
  expect(readGoogleEvent({ id: 'madeingoogle', etag: '"y"', summary: 'Lunch' }, fixturePlan, state)).toEqual({
    kind: 'none',
  })
})

test('a time without an offset is read on its own clock, whatever the zone of the machine', () => {
  expect(wallOf({ dateTime: '2026-12-01T18:30:00', timeZone: TZ })).toBe('2026-12-01T18:30')
  expect(wallOf({ dateTime: '2026-12-01T15:30:00Z' })).toBe('2026-12-01T18:30')
  expect(wallOf({ date: '2026-12-01' })).toBe('2026-12-01')
  expect(rowOf(googleBody(session, TZ), 'g', 'e')).toMatchObject({ start: session.start, end: session.end })
})

test('a calendar gone from the plan is dropped; a new reading of an event replaces what it proposed', () => {
  const state = synced(fixturePlan)
  const gone = itemAt(fixturePlan.calendars)
  const without = { ...fixturePlan, calendars: fixturePlan.calendars.filter((c) => c.id !== gone.id) }
  expect(planPush(without, state).drop).toEqual([gone.id])

  const read = (summary: string) => readGoogleEvent(inGoogle(session.uid, { summary }), fixturePlan, state)
  const ticked = read(`✓ ${session.title}`)
  const proposals = ticked.kind === 'proposal' ? ticked.proposals : []
  const source = googleEventId(session.uid)
  const inbox = fileProposals([], source, proposals)
  expect(inbox).toHaveLength(1)
  expect(inbox[0]?.source).toBe(source)
  expect(fileProposals(inbox, source, [])).toEqual([])
  expect(fileProposals(inbox, 'other', [])).toEqual(inbox)

  const stored = structuredClone({ ...state, inbox, lastRound: 5, junk: 1 })
  expect(parseGoogleSync(stored)).toEqual({ ...state, inbox, lastRound: 5, error: undefined })
  expect(parseGoogleSync({ inbox: [{ id: 'x' }, ...inbox], events: { a: 1 } }).inbox).toEqual(inbox)
  expect(parseGoogleSync(null)).toEqual({ calendars: {}, events: {}, inbox: [] })
})

/** What reading `edit` of the session in Google proposes. */
const proposed = (edit: Partial<GoogleEvent>, state = synced(fixturePlan)): Proposal[] => {
  const reading = readGoogleEvent(inGoogle(session.uid, edit), fixturePlan, state)
  return reading.kind === 'proposal' ? reading.proposals : []
}

test('an edit made in Google is taken unless the planner changed the same thing since it was written', () => {
  const day = session.start.slice(0, 10)
  const move = { start: { dateTime: `${day}T06:00:00+03:00` }, end: { dateTime: `${day}T07:00:00+03:00` } }
  const tick = { summary: `✓ ${session.title}` }
  expect(triage(fixturePlan, synced(fixturePlan), proposed(move))).toMatchObject({ take: [{}], hold: [] })

  // The planner renamed the session since it was written: a move in Google does not touch the title.
  const renamed = changed(fixturePlan, { type: 'event.patch', uid: session.uid, patch: { title: 'Renamed' } })
  const state = synced(fixturePlan)
  expect(triage(renamed, state, proposed(move, state)).take).toHaveLength(1)
  expect(triage(renamed, state, proposed(tick, state)).take).toHaveLength(1)
  expect(triage(renamed, state, proposed({ summary: 'Other' }, state)).hold).toMatchObject([{ hold: 'both' }])

  // The planner moved it too: Google's move waits, and so does a deletion of what the planner changed.
  const later = { start: session.start.replace(/T\d\d/, 'T20'), end: session.end.replace(/T\d\d/, 'T21') }
  const moved = changed(fixturePlan, { type: 'event.patch', uid: session.uid, patch: later })
  expect(triage(moved, state, proposed(move, state)).hold).toMatchObject([{ hold: 'both' }])
  expect(triage(moved, state, proposed({ status: 'cancelled' }, state)).hold).toHaveLength(1)
  expect(triage(fixturePlan, state, proposed({ status: 'cancelled' }, state)).take).toHaveLength(1)

  // One the plan cannot take waits too.
  const backwards = { start: { dateTime: `${day}T08:00:00+03:00` }, end: { dateTime: `${day}T07:00:00+03:00` } }
  expect(triage(fixturePlan, state, proposed(backwards, state)).hold).toMatchObject([{ hold: 'misfit' }])
})
