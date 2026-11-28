import { expect, test } from 'vitest'

import { fixtureBase, itemAt } from '../fixtures'
import { applyChange } from './changes'
import { parseLocal, toLocalString } from './dates'
import { applyEdits, emptyEdits, type EventPatch, type PlanEdits } from './edits'
import { isSession } from './progress'
import {
  groupBar,
  groupOf,
  likelyLength,
  openGroups,
  restMinutes,
  sittingAt,
  sittingGroups,
  type SessionGroup,
} from './sittings'
import type { Plan, PlanEvent } from './types'

const base = fixtureBase
const MINUTE = 60_000
const NOW = Date.parse('2026-11-23T09:00:00Z')

/** 2026-11-23 12:00–13:00 */
const SESSION = 'certs-001@learning-curve'
const ROOT = SESSION
/** 2026-11-23 13:00–14:00 */
const NEXT = 'certs-002@learning-curve'
/** 2026-11-24 12:00–13:00 */
const OTHER = 'certs-003@learning-curve'
/** 2026-11-25 12:00–13:00 */
const THIRD = 'certs-005@learning-curve'
const GYM = 'personal-001@learning-curve'
const SITTING_2 = 'sitting-2@learning-curve'
const SITTING_3 = 'sitting-3@learning-curve'

const root = itemAt(base.events.filter((e) => e.uid === ROOT))
const DONE_25: EventPatch = { done: true, actual: 25, unfinished: true }

/** A sitting added to continue the root, `minutes` long from `start` */
const sitting = (uid: string, start: string, minutes: number, fields: Partial<PlanEvent> = {}): PlanEvent => ({
  ...root,
  uid,
  start,
  end: toLocalString(parseLocal(start) + minutes * MINUTE),
  from: ROOT,
  ...fields,
})

/** The generated plan with the patches and the added sittings given */
const planWith = (events: Record<string, EventPatch>, added: PlanEvent[] = [], more: Partial<PlanEdits> = {}): Plan =>
  applyEdits(base, { ...emptyEdits(), events, added, ...more }).plan

/** The group of `uid`, which the test counts on */
function groupIn(plan: Plan, uid: string): SessionGroup {
  const group = groupOf(plan, uid)
  if (!group) throw new Error(`No group holds ${uid}`)
  return group
}

const segmentsOf = (group: SessionGroup) => groupBar(group).segments.map((s) => [s.kind, s.minutes])

/** The root done in 25 minutes and unfinished, and a second sitting with `fields` */
const secondSitting = (fields: Partial<PlanEvent>) =>
  groupIn(planWith({ [ROOT]: DONE_25 }, [sitting(SITTING_2, '2026-11-24T18:00', 30, fields)]), ROOT)

/** The root's group with the minutes given, as `restMinutes` reads it */
const groupWith = ({
  firstPlan,
  done,
  booked = 0,
}: {
  firstPlan: number
  done: number
  booked?: number
}): SessionGroup => ({
  ...groupIn(base, ROOT),
  state: 'open',
  firstPlan,
  doneMinutes: done,
  bookedMinutes: booked,
})

test('a session never split nor continued is a group of one, not linked', () => {
  const plan = base
  expect(groupOf(plan, SESSION)).toMatchObject({
    key: SESSION,
    state: 'planned',
    linked: false,
    firstPlan: 60,
    next: { uid: SESSION },
  })
  expect(sittingGroups(plan)).toHaveLength(plan.events.filter(isSession).length)
  expect(groupOf(plan, GYM)).toBeNull()
})

test('three sittings: 25 done and unfinished, 20 done, 15 booked', () => {
  const plan = planWith({ [ROOT]: DONE_25 }, [
    sitting(SITTING_2, '2026-11-24T18:00', 30, { done: true, actual: 20 }),
    sitting(SITTING_3, '2026-11-25T18:00', 15),
  ])
  const group = groupIn(plan, ROOT)
  expect(group).toMatchObject({
    state: 'open',
    linked: true,
    doneMinutes: 45,
    bookedMinutes: 15,
    firstPlan: 60,
    next: { uid: SITTING_3 },
  })
  expect(groupOf(plan, SITTING_2)?.key).toBe(ROOT)
  expect(segmentsOf(group)).toEqual([
    ['done', 25],
    ['done', 20],
    ['booked', 15],
  ])
  expect(groupBar(group)).toMatchObject({ total: 60, tick: null })
})

test('a lone session marked unfinished is linked and open, with the rest of the plan empty', () => {
  const group = groupIn(planWith({ [ROOT]: DONE_25 }), ROOT)
  expect(group).toMatchObject({ state: 'open', linked: true, next: null })
  expect(groupBar(group)).toEqual({
    total: 60,
    segments: [
      { kind: 'done', minutes: 25, uid: ROOT },
      { kind: 'rest', minutes: 35, uid: null },
    ],
    tick: null,
  })
})

test('past the first plan the bar grows and the tick marks the plan', () => {
  const plan = planWith({ [ROOT]: DONE_25 }, [
    sitting(SITTING_2, '2026-11-24T18:00', 30, { done: true, actual: 40, unfinished: true }),
    sitting(SITTING_3, '2026-11-25T18:00', 20),
  ])
  const group = groupIn(plan, ROOT)
  expect(groupBar(group)).toMatchObject({ total: 85, tick: 60 })
  expect(segmentsOf(group)).toEqual([
    ['done', 25],
    ['done', 40],
    ['booked', 20],
  ])
})

test('every sitting done and the last not unfinished: finished', () => {
  const finished = secondSitting({ done: true, actual: 20 })
  expect(finished).toMatchObject({ state: 'finished', linked: true, doneMinutes: 45, bookedMinutes: 0, next: null })
  expect(groupBar(finished)).toMatchObject({ total: 60, tick: null })
  expect(segmentsOf(finished)).toEqual([
    ['done', 25],
    ['done', 20],
  ])
  expect(secondSitting({ done: true, actual: 20, unfinished: true }).state).toBe('open')
})

test('a skipped sitting is done for the state and adds nothing', () => {
  const skipped = { done: true, skipped: true }
  const booked = planWith({ [ROOT]: DONE_25 }, [
    sitting(SITTING_2, '2026-11-24T18:00', 30, skipped),
    sitting(SITTING_3, '2026-11-25T18:00', 15),
  ])
  const open = groupIn(booked, ROOT)
  expect(open).toMatchObject({ state: 'open', doneMinutes: 25, bookedMinutes: 15, next: { uid: SITTING_3 } })
  expect(groupBar(open).segments.map((s) => [s.kind, s.uid])).toEqual([
    ['done', ROOT],
    ['booked', SITTING_3],
    ['rest', null],
  ])

  const allSkipped = planWith({ [ROOT]: DONE_25 }, [
    sitting(SITTING_2, '2026-11-24T18:00', 30, skipped),
    sitting(SITTING_3, '2026-11-25T18:00', 15, skipped),
  ])
  expect(groupIn(allSkipped, ROOT)).toMatchObject({ state: 'finished', doneMinutes: 25, bookedMinutes: 0 })
})

test('a group whose root is in the trash takes the first plan from its earliest sitting', () => {
  const plan = planWith(
    {},
    [
      sitting(SITTING_2, '2026-11-24T18:00', 40, { done: true, actual: 20, unfinished: true }),
      sitting(SITTING_3, '2026-11-25T18:00', 30),
    ],
    { removed: { events: { [ROOT]: '2026-11-26T09:00:00.000Z' }, calendars: {} } },
  )
  expect(groupIn(plan, SITTING_3)).toMatchObject({
    key: ROOT,
    calendar: root.calendar,
    title: root.title,
    firstPlan: 40,
    state: 'open',
    doneMinutes: 20,
    bookedMinutes: 30,
  })
})

test('split parts form a planned group whose parts add up to the first plan', () => {
  const edits = applyChange(
    base,
    emptyEdits(),
    {
      type: 'event.split',
      uid: SESSION,
      parts: [
        { start: '2026-11-23T12:00', end: '2026-11-23T12:30' },
        { start: '2026-11-26T18:00', end: '2026-11-26T18:30' },
      ],
    },
    NOW,
  )
  const group = groupIn(applyEdits(base, edits).plan, SESSION)
  expect(group).toMatchObject({ state: 'planned', linked: true, firstPlan: 60, doneMinutes: 0, bookedMinutes: 60 })
  expect(group.sittings).toHaveLength(2)
  expect(groupBar(group)).toMatchObject({ total: 60, tick: null })
  expect(segmentsOf(group)).toEqual([
    ['booked', 30],
    ['booked', 30],
  ])
})

test('openGroups leaves hidden calendars out and lists the latest worked first', () => {
  const course = itemAt(base.events.filter((e) => e.calendar === 'hfllm' && isSession(e)))
  const plan = planWith(
    {
      [ROOT]: DONE_25,
      // Studied two days late: the stopwatch's start, not the slot, says when it was worked on.
      [OTHER]: { ...DONE_25, began: '2026-11-26T08:00' },
      [THIRD]: DONE_25,
      [course.uid]: DONE_25,
      [NEXT]: { done: true, actual: 60 },
    },
    [sitting(SITTING_2, '2026-11-25T18:00', 30, { done: true, actual: 30, unfinished: true })],
  )
  expect(openGroups(plan, new Set(['hfllm'])).map((g) => g.key)).toEqual([OTHER, ROOT, THIRD])
  expect(openGroups(plan, new Set()).map((g) => g.key)).toContain(course.uid)
})

test('restMinutes is what is left of the likely length, rounded to 5, at least 15', () => {
  expect(restMinutes(groupWith({ firstPlan: 60, done: 25 }), 1)).toBe(35)
  expect(restMinutes(groupWith({ firstPlan: 60, done: 25 }), 1.25)).toBe(50)
  expect(restMinutes(groupWith({ firstPlan: 60, done: 23 }), 1)).toBe(35)
  expect(restMinutes(groupWith({ firstPlan: 60, done: 60 }), 1)).toBe(15)
  expect(restMinutes(groupWith({ firstPlan: 60, done: 25, booked: 15 }), 1)).toBe(20)
})

test('likelyLength rounds the plan times the ratio to 5 minutes', () => {
  expect(likelyLength(60 * MINUTE, 1.25)).toBe(75 * MINUTE)
  expect(likelyLength(60 * MINUTE, 1.22)).toBe(75 * MINUTE)
  expect(likelyLength(120 * MINUTE, 0.83)).toBe(100 * MINUTE)
})

test('sittingAt finds the not-done sitting of a group by its start', () => {
  const plan = planWith({ [ROOT]: DONE_25 }, [sitting(SITTING_2, '2026-11-25T18:00', 30)])
  expect(sittingAt(plan, ROOT, '2026-11-25T18:00')?.uid).toBe(SITTING_2)
  expect(sittingAt(plan, ROOT, root.start)).toBeNull()
  expect(sittingAt(plan, OTHER, '2026-11-25T18:00')).toBeNull()
})
