import { describe, expect, test } from 'vitest'

import type { BusyBlock } from '../core/busy'
import { parseLocal, weekday } from '../core/dates'
import type { Plan, PlanEvent } from '../core/types'
import { movingSessions } from './request'
import { roomOf } from './room'
import type { RebalanceRequest } from './types'

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

const gym = event('personal', '2026-11-23T08:30', '2026-11-23T10:30', {
  kind: 'personal',
  rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
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
    { id: 'personal', name: 'Personal', color: '#888888', isNew: false },
  ],
  events: [gym, ...events],
})

const request = (overrides: Partial<RebalanceRequest> = {}): RebalanceRequest => ({
  calendar: 'c',
  from: '2026-12-07',
  target: { mode: 'rhythm', perDay: 1 },
  overBudget: false,
  hours: { from: '11:00', to: '14:00' },
  ...overrides,
})

/** The room of the calendar `c` in `on`, from Monday 2026-12-07 before the day starts */
const room = (on: Plan, overrides: Partial<RebalanceRequest> = {}, busy: BusyBlock[] = [], now = 0) => {
  const asked = request(overrides)
  return roomOf(on, asked, movingSessions(on, asked), now || parseLocal('2026-12-07T08:00'), busy)
}
const dayOf = (r: ReturnType<typeof room>, day: string) => r.days.find((d) => d.day === day)
const at = (...times: string[]) => times.map((t) => parseLocal(t))

const course = [event('c', '2026-12-07T11:00', '2026-12-07T12:00'), event('c', '2026-12-09T11:00', '2026-12-09T12:00')]
const busyTuesday = plan([...course, event('o', '2026-12-08T12:00', '2026-12-08T13:00')])

describe('roomOf', () => {
  test("starts at the course's first open session when that comes after the first day", () => {
    const later = plan([event('c', '2026-12-09T11:00', '2026-12-09T12:00')])
    expect(room(later).days[0]).toMatchObject({ day: '2026-12-09', index: 1 })
  })

  test('a day keeps the half hours other calendars leave free inside the study hours; the gym blocks none', () => {
    expect(dayOf(room(busyTuesday), '2026-12-08')).toMatchObject({
      week: '2026-12-07',
      index: 2,
      slots: at('2026-12-08T11:00', '2026-12-08T11:30', '2026-12-08T13:00', '2026-12-08T13:30'),
      cap: 2,
      lab: false,
    })
  })

  test('a day has room for a lab when two free hours follow each other', () => {
    expect(dayOf(room(busyTuesday, { hours: { from: '11:00', to: '15:00' } }), '2026-12-08')?.lab).toBe(true)
  })

  test("the moving sessions' own slots are free", () => {
    expect(dayOf(room(busyTuesday), '2026-12-07')).toMatchObject({ index: 1, cap: 3, lab: true })
  })

  test('the study days are the weekdays, without holidays and days taken whole by the busy calendar', () => {
    const trip: BusyBlock = {
      title: 'Trip',
      s: parseLocal('2026-12-10T00:00'),
      e: parseLocal('2026-12-11T00:00'),
      allDay: true,
    }
    const r = room(plan(course, ['2026-12-09']), {}, [trip])
    expect(r.days.slice(0, 4).map((d) => d.day)).toEqual(['2026-12-07', '2026-12-08', '2026-12-11', '2026-12-14'])
    expect(r.daysOff).toEqual(['2026-12-10'])
  })

  test('a calendar studied only on Saturdays keeps to Saturdays', () => {
    const saturdays = plan([
      event('c', '2026-12-12T11:00', '2026-12-12T12:00'),
      event('c', '2026-12-19T11:00', '2026-12-19T12:00'),
    ])
    const r = room(saturdays)
    expect(r.days.length).toBeGreaterThan(0)
    expect(r.days.every((d) => weekday(parseLocal(`${d.day}T00:00`)) === 6)).toBe(true)
  })

  test('a weekday calendar takes no weekend', () => {
    expect(room(busyTuesday).days.some((d) => weekday(parseLocal(`${d.day}T00:00`)) % 6 === 0)).toBe(false)
  })

  test('a session outside the study hours is room for itself only', () => {
    const late = event('c', '2026-12-08T21:00', '2026-12-08T22:00')
    const r = room(plan([...course, late]))
    expect(r.own.get(late.uid)).toEqual({
      day: '2026-12-08',
      start: parseLocal('2026-12-08T21:00'),
      end: parseLocal('2026-12-08T22:00'),
      outside: true,
    })
    expect(r.own.get(course[0]?.uid ?? '')?.outside).toBe(false)
    expect(dayOf(r, '2026-12-08')?.slots.at(-1)).toBe(parseLocal('2026-12-08T13:30'))
  })

  test('a slot outside the study hours that has passed is no room for its session', () => {
    const early = event('c', '2026-12-07T08:00', '2026-12-07T09:00')
    const r = room(plan([early, ...course]), {}, [], parseLocal('2026-12-07T10:00'))
    expect(r.own.get(early.uid)?.outside).toBe(false)
  })

  test('slots that have passed today are not room', () => {
    const r = room(busyTuesday, {}, [], parseLocal('2026-12-07T12:10'))
    expect(dayOf(r, '2026-12-07')?.slots).toEqual(at('2026-12-07T12:30', '2026-12-07T13:00', '2026-12-07T13:30'))
  })

  test('busy time of the busy calendar is not room', () => {
    const meeting: BusyBlock = {
      title: 'Meeting',
      s: parseLocal('2026-12-08T11:00'),
      e: parseLocal('2026-12-08T12:00'),
    }
    expect(dayOf(room(busyTuesday, {}, [meeting]), '2026-12-08')?.slots).toEqual(
      at('2026-12-08T13:00', '2026-12-08T13:30'),
    )
  })

  test("a week's room is the budget less everything else that counts, never below zero", () => {
    const full = ['14', '15', '16', '17', '18', '19'].flatMap((day) => [
      event('o', `2026-12-${day}T09:00`, `2026-12-${day}T10:00`),
      event('o', `2026-12-${day}T15:00`, `2026-12-${day}T16:00`),
    ])
    const r = room(plan([...course, ...full]))
    expect(r.weeks.get('2026-12-14')).toEqual({ left: 0, fixed: 12 })
    expect(r.weeks.get('2026-12-07')).toEqual({ left: 12, fixed: 0 })
  })

  test('the room is the year from the first day, at any rhythm and towards any deadline', () => {
    // A course on a few weekend days, or a tight budget, can need many weeks: the model cuts what it does not use.
    expect(room(busyTuesday).days.at(-1)?.day).toBe('2027-12-07')
    const towards = room(busyTuesday, { target: { mode: 'deadline' }, deadline: '2027-02-01' })
    expect(towards.deadline).toBe('2027-02-01')
    expect(towards.days.at(-1)?.day).toBe('2027-12-07')
    expect(room(busyTuesday, { target: { mode: 'deadline' }, deadline: '2028-06-01' }).days.at(-1)?.day).toBe(
      '2027-12-07',
    )
  })
})
