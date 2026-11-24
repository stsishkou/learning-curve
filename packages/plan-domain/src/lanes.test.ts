import { describe, expect, test } from 'vitest'

import type { PlanChange } from './changes'
import { DAY, parseLocal } from './dates'
import { deadlineEvent } from './deadlines'
import { fixtureNow, fixturePlan, itemAt } from './fixtures'
import { calendarLanes, compareLanes, laneMoveBounds, laneSpare, lanesRange, movedSessions } from './lanes'
import { isSession } from './progress'
import type { Plan, PlanEvent } from './types'
import { previewUpdate } from './update'

const NONE: ReadonlySet<string> = new Set()
const certs = fixturePlan.events
  .filter((e) => e.calendar === 'certs' && isSession(e))
  .toSorted((a, b) => a.start.localeCompare(b.start))

const withEvents = (change: (e: PlanEvent) => PlanEvent): Plan => ({
  ...fixturePlan,
  events: fixturePlan.events.map(change),
})
const laneOf = (plan: Plan, now: number | null, id: string) =>
  calendarLanes(plan, now, NONE).find((lane) => lane.calendar.id === id)

describe('calendarLanes', () => {
  test('one lane per calendar with sessions, in calendar order', () => {
    expect(calendarLanes(fixturePlan, fixtureNow, NONE).map((lane) => lane.calendar.id)).toEqual([
      'certs',
      'hfllm',
      'hfagents',
      'pypy',
    ])
  })

  test('a hidden calendar has no lane', () => {
    const ids = calendarLanes(fixturePlan, fixtureNow, new Set(['hfllm'])).map((lane) => lane.calendar.id)
    expect(ids).toEqual(['certs', 'hfagents', 'pypy'])
  })

  test('a lane holds its first and last day, its deadline and how many are done', () => {
    expect(laneOf(fixturePlan, fixtureNow, 'certs')).toMatchObject({
      first: '2026-11-23',
      last: '2026-12-23',
      deadline: '2026-12-30',
      total: 40,
      done: 14,
      openFrom: '2026-12-02',
    })
  })

  test('a past session that is not done is missed', () => {
    const forgotten = itemAt(certs, 0)
    const plan = withEvents((e) => (e.uid === forgotten.uid ? { ...e, done: false } : e))
    const sessions = laneOf(plan, fixtureNow, 'certs')?.sessions ?? []
    expect(sessions.find((s) => s.uid === forgotten.uid)?.state).toBe('missed')
    expect(sessions.find((s) => s.uid === itemAt(certs, 1).uid)?.state).toBe('done')
    expect(sessions.find((s) => s.uid === itemAt(certs, 39).uid)?.state).toBe('open')
  })

  test('a finished course past its deadline has no lane, one before it keeps its lane', () => {
    const finished = withEvents((e) => (e.calendar === 'certs' && isSession(e) ? { ...e, done: true } : e))
    expect(laneOf(finished, parseLocal('2027-01-05T09:00'), 'certs')).toBeUndefined()
    expect(laneOf(finished, fixtureNow, 'certs')?.openFrom).toBeNull()
  })

  test('before the clock is known nothing is missed', () => {
    const forgotten = itemAt(certs, 0)
    const plan = withEvents((e) => (e.uid === forgotten.uid ? { ...e, done: false } : e))
    const states = new Set(laneOf(plan, null, 'certs')?.sessions.map((s) => s.state))
    expect(states.has('missed')).toBe(false)
    expect(states.has('open')).toBe(true)
  })
})

describe('lanesRange', () => {
  test('the range starts the Monday a week before today and ends two weeks after the last session or deadline', () => {
    expect(lanesRange(calendarLanes(fixturePlan, fixtureNow, NONE), fixtureNow)).toEqual({
      start: parseLocal('2026-11-23'),
      end: parseLocal('2027-03-24'),
    })
  })

  test('a deadline already past reaches back into the range', () => {
    const now = parseLocal('2027-01-20T09:00')
    expect(lanesRange(calendarLanes(fixturePlan, now, NONE), now)?.start).toBe(parseLocal('2026-12-28'))
  })

  test('the range is at least four weeks', () => {
    const now = parseLocal('2026-12-28T09:00')
    const range = lanesRange(calendarLanes(fixturePlan, now, new Set(['hfllm', 'hfagents', 'pypy'])), now)
    expect(range?.start).toBe(parseLocal('2026-12-21'))
    expect(range && (range.end - range.start) / DAY).toBe(28)
  })

  test('before the clock is known the range starts a week before the first open session', () => {
    const range = lanesRange(calendarLanes(fixturePlan, null, new Set(['certs'])), null)
    expect(range?.start).toBe(parseLocal('2026-12-28'))
  })

  test('no lanes, no range', () => {
    expect(lanesRange([], fixtureNow)).toBeNull()
  })
})

const lanesAt = (plan: Plan) => calendarLanes(plan, fixtureNow, NONE)
const compare = (changes: PlanChange[]) => {
  const { after, diff } = previewUpdate(fixturePlan, changes, fixtureNow)
  return compareLanes(lanesAt(fixturePlan), lanesAt(after), movedSessions(diff))
}

describe('compareLanes', () => {
  test('a course moved two weeks: its open sessions move and its end moves 14 days', () => {
    const changed = compare([{ type: 'events.shift', calendars: ['certs'], from: '2026-12-02', days: 14 }])
    expect([...changed.keys()]).toEqual(['certs'])
    expect(changed.get('certs')).toMatchObject({ moved: 26, startDays: 0, endDays: 14 })
    expect(changed.get('certs')?.after.last).toBe('2027-01-06')
  })

  test('a moved deadline changes only the deadline and the spare days', () => {
    const before = laneOf(fixturePlan, fixtureNow, 'certs')
    const deadline = deadlineEvent(fixturePlan, 'certs')
    const changed = compare([
      { type: 'event.patch', uid: deadline?.uid ?? '', patch: { start: '2027-01-06T00:00', end: '2027-01-06T00:00' } },
    ])
    expect(changed.get('certs')).toMatchObject({ moved: 0, startDays: 0, endDays: 0 })
    expect(before && laneSpare(before)).toBe(6)
    const after = changed.get('certs')?.after
    expect(after && laneSpare(after)).toBe(13)
  })

  test('lanes that do not change are left out', () => {
    expect(compare([]).size).toBe(0)
  })

  test('marking a session done moves nothing', () => {
    const open = certs.find((e) => !e.done)
    const changed = compare([{ type: 'events.done', uids: [open?.uid ?? ''], done: true }])
    expect(changed.size).toBe(0)
  })

  test('a course without a deadline has no spare days', () => {
    const lane = laneOf(fixturePlan, fixtureNow, 'pypy')
    expect(lane?.deadline).toBeNull()
    expect(lane && laneSpare(lane)).toBeNull()
  })
})

describe('laneMoveBounds', () => {
  const lane = laneOf(fixturePlan, fixtureNow, 'certs')

  test('the open sessions move back no further than today, in whole weeks', () => {
    expect(lane?.openFrom).toBe('2026-12-02')
    expect(lane && laneMoveBounds(lane, '2026-12-02')?.min).toBe(0)
    expect(lane && laneMoveBounds(lane, '2026-11-29')?.min).toBe(0)
    expect(lane && laneMoveBounds(lane, '2026-11-25')?.min).toBe(-7)
    expect(lane && laneMoveBounds(lane, '2026-11-18')?.min).toBe(-14)
  })

  test('they move forward at most the 52 weeks one shift allows', () => {
    expect(lane && laneMoveBounds(lane, '2026-12-02')?.max).toBe(364)
  })

  test('a course with nothing left from today on cannot move', () => {
    expect(lane && laneMoveBounds(lane, '2026-12-24')).toBeNull()
  })
})
