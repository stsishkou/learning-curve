import { describe, expect, test } from 'vitest'

import { DAY, parseLocal } from './dates'
import { fixtureNow, fixturePlan, itemAt } from './fixtures'
import { calendarLanes, lanesRange } from './lanes'
import { isSession } from './progress'
import type { Plan, PlanEvent } from './types'

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
  test('the range starts the Monday a week before today and ends after the last session or deadline', () => {
    expect(lanesRange(calendarLanes(fixturePlan, fixtureNow, NONE), fixtureNow)).toEqual({
      start: parseLocal('2026-11-23'),
      end: parseLocal('2027-03-10'),
    })
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
