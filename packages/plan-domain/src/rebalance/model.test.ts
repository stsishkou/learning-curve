import { describe, expect, test } from 'vitest'

import { parseLocal } from '../dates'
import type { PlanEvent } from '../types'
import type { LpModel, LpTerm } from './lp'
import { buildModel, readDays } from './model'
import type { Room, RoomDay } from './room'
import type { RebalanceRequest } from './types'

const session = (n: number, start: string, end: string, kind: PlanEvent['kind'] = 'study'): PlanEvent => ({
  uid: `s${n}`,
  calendar: 'c',
  title: `Course — Part ${n}`,
  start,
  end,
  description: '',
  kind,
  availability: 'busy',
})

const sessions = [
  session(1, '2026-12-07T11:00', '2026-12-07T12:00'),
  session(2, '2026-12-14T11:00', '2026-12-14T13:00', 'lab'),
  session(3, '2026-12-08T21:00', '2026-12-08T22:00'),
]

const roomDay = (index: number, day: string, week: string, cap: number, lab: boolean): RoomDay => ({
  day,
  week,
  index,
  slots: [],
  cap,
  lab,
})

const own = (start: string, end: string, outside = false) => ({
  day: start.slice(0, 10),
  start: parseLocal(start),
  end: parseLocal(end),
  outside,
})

/** Four study days in two weeks: room for a lab on the first and the last, none on the second. */
const room: Room = {
  days: [
    roomDay(1, '2026-12-07', '2026-12-07', 2, true),
    roomDay(2, '2026-12-08', '2026-12-07', 0, false),
    roomDay(3, '2026-12-14', '2026-12-14', 1, false),
    roomDay(4, '2026-12-15', '2026-12-14', 2, true),
  ],
  weeks: new Map([
    ['2026-12-07', { left: 10, fixed: 2 }],
    ['2026-12-14', { left: 12, fixed: 0 }],
  ]),
  deadline: '2026-12-15',
  daysOff: [],
  own: new Map([
    ['s1', own('2026-12-07T11:00', '2026-12-07T12:00')],
    ['s2', own('2026-12-14T11:00', '2026-12-14T13:00')],
    ['s3', own('2026-12-08T21:00', '2026-12-08T22:00', true)],
  ]),
}

const request = (overrides: Partial<RebalanceRequest> = {}): RebalanceRequest => ({
  calendar: 'c',
  from: '2026-12-07',
  target: { mode: 'deadline' },
  overBudget: false,
  hours: { from: '11:00', to: '14:00' },
  ...overrides,
})

const names = (model: Omit<LpModel, 'objective'>) => model.variables.map((v) => v.name)
const row = (model: Omit<LpModel, 'objective'>, name: string) => model.constraints.find((c) => c.name === name)
const sum = (...vars: string[]): LpTerm[] => vars.map((v) => ({ v, c: 1 }))

describe('buildModel', () => {
  test('puts a session only on days with room for it, and a lab only where two hours follow each other', () => {
    const { model } = buildModel(room, sessions, request())
    const days = (i: number) => names(model).filter((n) => n.startsWith(`y_${i}_`))
    expect(days(0)).toEqual(['y_0_1', 'y_0_3', 'y_0_4'])
    expect(days(1)).toEqual(['y_1_1', 'y_1_4'])
  })

  test('a session outside the study hours may stay on its own day, outside the day room', () => {
    const { model } = buildModel(room, sessions, request())
    expect(names(model)).toContain('y_2_2')
    expect(row(model, 'room_2')).toBeUndefined()
    expect(row(model, 'room_1')?.terms.map((t) => t.v)).toEqual(['y_0_1', 'y_1_1', 'y_2_1'])
  })

  test('keeps the order of the sessions, and the unplaced ones are the tail', () => {
    const { model } = buildModel(room, sessions, request())
    expect(row(model, 'order_0')).toEqual({
      name: 'order_0',
      terms: [
        { v: 't_0', c: 1 },
        { v: 't_1', c: -1 },
        { v: 'u_1', c: -4 },
      ],
      op: '<=',
      rhs: 0,
    })
    expect(row(model, 'order_1')).toBeDefined()
    expect(row(model, 'order_2')).toBeUndefined()
    expect(row(model, 'tail_0')?.terms).toEqual([
      { v: 'u_0', c: 1 },
      { v: 'u_1', c: -1 },
    ])
  })

  test('holds the weeks to their room unless going over the budget is allowed', () => {
    const hard = buildModel(room, sessions, request()).model
    expect(names(hard).some((n) => n.startsWith('over_'))).toBe(false)
    expect(row(hard, 'week_1')).toMatchObject({ terms: sum('L_1', 'L_2'), op: '<=', rhs: 10 })
    const soft = buildModel(room, sessions, request({ overBudget: true })).model
    expect(row(soft, 'week_1')?.terms).toEqual([...sum('L_1', 'L_2'), { v: 'over_1', c: -1 }])
  })

  test('a session on or after the deadline day is late', () => {
    const { model } = buildModel(room, sessions, request())
    expect(row(model, 'late_0')).toEqual({
      name: 'late_0',
      terms: [
        { v: 'late_0', c: 1 },
        { v: 'y_0_4', c: -1 },
      ],
      op: '=',
      rhs: 0,
    })
  })

  test('towards a deadline the ideal line runs straight to the last study day before it', () => {
    const { model } = buildModel(room, sessions, request())
    // Four hours over the three study days before 15 December.
    expect(row(model, 'above_1')?.rhs).toBeCloseTo(4 / 3, 9)
    expect(row(model, 'above_3')?.rhs).toBeCloseTo(4, 9)
    expect(row(model, 'above_4')?.rhs).toBeCloseTo(4, 9)
  })

  test('at a pace the ideal line is the rhythm asked for, until the course is done', () => {
    const { model } = buildModel(room, sessions, request({ target: { mode: 'pace', perDay: 1 / 2 } }))
    // Half a session a day of 4/3 hours on average.
    expect(row(model, 'above_1')?.rhs).toBeCloseTo(2 / 3, 9)
    expect(row(model, 'above_4')?.rhs).toBeCloseTo(8 / 3, 9)
  })

  test('towards a deadline: nothing unplaced, then nothing late, then the least over the budget', () => {
    const { levels } = buildModel(room, sessions, request({ overBudget: true }))
    expect(levels.slice(0, 5)).toEqual([
      sum('u_0', 'u_1', 'u_2'),
      sum('late_0', 'late_1', 'late_2'),
      sum('over_1', 'over_2'),
      sum('Pw'),
      sum('Pd'),
    ])
    // The lab's own day has no two free hours, so only two sessions can keep their day.
    expect(levels.at(-2)).toEqual([
      { v: 'y_0_1', c: -1 },
      { v: 'y_2_2', c: -1 },
    ])
    expect(levels.at(-1)).toEqual(sum('t_0', 't_1', 't_2'))
  })

  test('at a pace: nothing unplaced, then the rhythm, and a level without terms is left out', () => {
    const { levels } = buildModel(room, sessions, request({ target: { mode: 'pace', perDay: 1 } }))
    expect(levels[1]).toEqual(sum('e_1', 'e_2', 'e_3', 'e_4'))
    expect(levels[2]).toEqual(sum('Pw'))
  })
})

describe('readDays', () => {
  test('reads the day of each session back, null for one left out, and whether it is late', () => {
    expect(readDays({ y_0_1: 1, y_1_4: 0.9999999, y_0_3: 0, u_2: 1 }, room, sessions)).toEqual({
      days: ['2026-12-07', '2026-12-15', null],
      late: [false, true, false],
    })
  })
})
