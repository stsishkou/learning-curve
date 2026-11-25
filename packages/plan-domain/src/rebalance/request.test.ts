import { describe, expect, test } from 'vitest'

import { fixturePlan } from '../fixtures'
import type { Plan, PlanEvent } from '../types'
import { currentRhythm, defaultStudyHours, movingSessions, nearestRhythm, parseRebalanceRequest } from './request'

const event = (calendar: string, start: string, end: string, extra: Partial<PlanEvent> = {}): PlanEvent => ({
  uid: `${calendar}-${start}`,
  calendar,
  title: `${calendar} ${start}`,
  start,
  end,
  description: '',
  kind: 'study',
  availability: 'busy',
  ...extra,
})

const plan = (events: PlanEvent[], holidays: string[] = []): Plan => ({
  meta: {
    title: 'Test',
    version: 1,
    timezone: 'Europe/Minsk',
    generated: '2026-11-22',
    weeklyBudgetHours: 12,
    holidays,
    planEnd: '2027-12-31',
  },
  calendars: [
    { id: 'c', name: 'Course', color: '#2F5BEA', isNew: false },
    { id: 'o', name: 'Other', color: '#0A7F5A', isNew: false },
  ],
  events,
})

const valid = {
  calendar: 'c',
  from: '2026-12-07',
  target: { mode: 'rhythm', perDay: 1 },
  overBudget: false,
  hours: { from: '11:00', to: '14:00' },
}
const withMilestone = plan([event('c', '2027-01-15T00:00', '2027-01-15T00:00', { kind: 'milestone', allDay: true })])

const refuse =
  (overrides: object, on: Plan = plan([])) =>
  () =>
    parseRebalanceRequest({ ...valid, ...overrides }, on)

describe('defaultStudyHours', () => {
  test('is the smallest window that holds nine of ten open weekday sessions', () => {
    expect(defaultStudyHours(fixturePlan)).toEqual({ from: '11:00', to: '14:00' })
  })

  test('is not stretched by a couple of sessions put late in the evening by hand', () => {
    const late = [
      event('certs', '2026-12-03T21:00', '2026-12-03T22:00'),
      event('certs', '2026-12-03T22:00', '2026-12-03T23:00'),
    ]
    expect(defaultStudyHours({ ...fixturePlan, events: [...fixturePlan.events, ...late] })).toEqual({
      from: '11:00',
      to: '14:00',
    })
  })
})

describe('parseRebalanceRequest', () => {
  test('reads a request', () => {
    expect(parseRebalanceRequest(valid, plan([]))).toEqual({ ...valid, deadline: undefined })
  })

  test('takes the default study hours when none are given', () => {
    const { hours: _hours, ...rest } = valid
    expect(parseRebalanceRequest({ ...rest, calendar: 'certs' }, fixturePlan).hours).toEqual({
      from: '11:00',
      to: '14:00',
    })
  })

  test('takes a third of a session a day as it comes back from JSON', () => {
    const target: unknown = JSON.parse('{"mode":"rhythm","perDay":0.3333333333333333}')
    const third = { ...valid, target }
    expect(parseRebalanceRequest(third, plan([])).target).toEqual({ mode: 'rhythm', perDay: 1 / 3 })
  })

  test('refuses an unknown calendar', () => {
    expect(refuse({ calendar: 'nope' })).toThrow('Unknown calendar "nope"')
  })

  test('refuses a day that is not a day', () => {
    expect(refuse({ from: '2026-13-01' })).toThrow('from must look like 2026-11-23')
    expect(refuse({ deadline: '15 Jan' })).toThrow('deadline must look like 2026-11-23')
  })

  test('refuses a rhythm that is not offered', () => {
    expect(refuse({ target: { mode: 'rhythm', perDay: 0.7 } })).toThrow(
      'The rhythm must be one of 1/3, 1/2, 1, 3/2, 2, 3 sessions a day',
    )
  })

  test('refuses the deadline mode when neither the request nor the calendar has a deadline', () => {
    expect(refuse({ target: { mode: 'deadline' } })).toThrow('needs a deadline')
    expect(parseRebalanceRequest({ ...valid, target: { mode: 'deadline' } }, withMilestone).target).toEqual({
      mode: 'deadline',
    })
  })

  test('refuses a deadline on or before the first day', () => {
    expect(refuse({ target: { mode: 'deadline' }, deadline: '2026-12-07' })).toThrow(
      'The deadline must come after the first day',
    )
    expect(refuse({ target: { mode: 'deadline' }, from: '2027-01-15' }, withMilestone)).toThrow(
      'The deadline must come after the first day',
    )
  })

  test('refuses study hours that end before they start', () => {
    expect(refuse({ hours: { from: '14:00', to: '11:00' } })).toThrow('The study hours must end after they start')
    expect(refuse({ hours: { from: '11:15', to: '14:00' } })).toThrow('Study hours must look like 11:00 or 11:30')
  })
})

describe('movingSessions', () => {
  test('are the open sessions of the calendar from the first day on, by start', () => {
    const later = event('c', '2026-12-09T11:00', '2026-12-09T12:00')
    const first = event('c', '2026-12-07T11:00', '2026-12-07T12:00')
    const events = [
      later,
      first,
      event('c', '2026-12-04T11:00', '2026-12-04T12:00'),
      event('c', '2026-12-08T11:00', '2026-12-08T12:00', { done: true }),
      event('c', '2026-12-08T13:00', '2026-12-08T13:30', { kind: 'review' }),
      event('o', '2026-12-08T11:00', '2026-12-08T12:00'),
    ]
    const moving = movingSessions(plan(events), parseRebalanceRequest(valid, plan(events)))
    expect(moving.map((e) => e.uid)).toEqual([first.uid, later.uid])
  })
})

/** A session of `c` of 45 minutes */
const at = (day: string, hour: string, extra: Partial<PlanEvent> = {}) =>
  event('c', `${day}T${hour}`, `${day}T${hour.slice(0, 2)}:45`, extra)

describe('currentRhythm', () => {
  // Monday 7 to Friday 11 December, the Wednesday a holiday: six open sessions on four study days.
  const week = [
    at('2026-12-07', '11:00'),
    at('2026-12-07', '12:00'),
    at('2026-12-08', '11:00'),
    at('2026-12-10', '11:00'),
    at('2026-12-10', '12:00'),
    at('2026-12-11', '11:00'),
  ]

  test('the open sessions per study day from the first to the last; holidays and weekends it does not use are not', () => {
    expect(currentRhythm(plan([...week, at('2026-12-04', '11:00')], ['2026-12-09']), 'c', '2026-12-07')).toBe(1.5)
  })

  test('done sessions and reviews do not count, and nothing is known of fewer than two sessions', () => {
    const done = week.map((e, i) => (i > 0 ? { ...e, done: true } : e))
    expect(currentRhythm(plan(done), 'c', '2026-12-07')).toBeNull()
    expect(currentRhythm(plan([...week, at('2026-12-11', '13:00', { kind: 'review' })]), 'c', '2026-12-07')).toBe(1.2)
  })

  test('the rhythm the dialog offers that comes nearest, by ratio', () => {
    expect(nearestRhythm(1.36)).toBe(1.5)
    expect(nearestRhythm(0.7)).toBe(0.5)
    expect(nearestRhythm(0.75)).toBe(1)
    expect(nearestRhythm(9)).toBe(3)
  })
})
