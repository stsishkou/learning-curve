import { describe, expect, test } from 'vitest'

import { parseLocal } from '../dates'
import type { PlanEvent } from '../types'
import type { LpModel, LpTerm } from './lp'
import { buildModel, earliestDays, reachOf, readDays, rhythmDays, targetDays } from './model'
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
    roomDay(1, '2026-12-07', '2026-12-07', 3, true),
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

/** `count` study days from 4 January 2027, each with three free hours and a lab block, in one roomy week. */
const plainRoom = (count: number, change: (d: RoomDay) => RoomDay = (d) => d): Room => ({
  days: Array.from({ length: count }, (_, k) =>
    change(roomDay(k + 1, `2027-01-${String(k + 4).padStart(2, '0')}`, '2027-01-04', 3, true)),
  ),
  weeks: new Map([['2027-01-04', { left: 100, fixed: 0 }]]),
  deadline: null,
  daysOff: [],
  own: new Map(),
})

/** `count` one-hour sessions, the first of them on `day`. */
const hours = (count: number, day = '2027-01-04') =>
  Array.from({ length: count }, (_, k) => session(k + 1, `${day}T11:00`, `${day}T12:00`))

describe('rhythmDays', () => {
  test('one every two study days, starting again from where a session had to wait for room', () => {
    const blocked = plainRoom(10, (d) => (d.index === 3 ? { ...d, cap: 0 } : d))
    expect(rhythmDays(blocked, hours(5), request(), 2)).toEqual([1, 4, 6, 8, 10])
  })

  test('three in two days keeps its fraction: two, one, two, one', () => {
    expect(rhythmDays(plainRoom(6), hours(6), request(), 2 / 3)).toEqual([1, 1, 2, 3, 3, 4])
  })

  test('without a gap it is the earliest placement', () => {
    expect(rhythmDays(room, sessions, request(), 0)).toEqual(earliestDays(room, sessions, request()))
    expect(earliestDays(plainRoom(4), hours(5), request())).toEqual([1, 1, 1, 2, 2])
  })

  test('a session that finds no day leaves the rest of the course without one too', () => {
    expect(rhythmDays(plainRoom(5), hours(4), request(), 2)).toEqual([1, 3, 5, null])
  })
})

describe('targetDays', () => {
  test('at a pace the rhythm starts at the first session of the course, not at the first day', () => {
    const pace = request({ target: { mode: 'pace', perDay: 1 } })
    expect(targetDays(plainRoom(8), hours(3, '2027-01-06'), pace)).toEqual([3, 4, 5])
  })

  test('towards a deadline it is the slowest rhythm that still ends before it', () => {
    // Seven study days before the deadline and four sessions: every other day is the slowest that fits.
    const due: Room = { ...plainRoom(10), deadline: '2027-01-11' }
    expect(targetDays(due, hours(4), request())).toEqual([1, 3, 5, 7])
  })

  test('towards a deadline the rhythm starts at the first day when that lets it run slower', () => {
    // From the course's own start on day 5, four sessions would need two a day; from day 1, one every other day fits.
    const due: Room = { ...plainRoom(10), deadline: '2027-01-11' }
    expect(targetDays(due, hours(4, '2027-01-08'), request())).toEqual([1, 3, 5, 7])
  })

  test('towards a deadline the budget holds whenever that still ends in time, even where going over is allowed', () => {
    // Two hours left in the first five days: every other day would put three sessions there.
    const split: Room = {
      ...plainRoom(10, (d) => ({ ...d, week: d.index <= 5 ? '2027-01-04' : '2027-01-11' })),
      weeks: new Map([
        ['2027-01-04', { left: 2, fixed: 0 }],
        ['2027-01-11', { left: 100, fixed: 0 }],
      ]),
      deadline: '2027-01-11',
    }
    const within = targetDays(split, hours(4), request())
    expect(within).not.toEqual([1, 3, 5, 7])
    expect(targetDays(split, hours(4), request({ overBudget: true }))).toEqual(within)
  })

  test('towards a deadline nothing can meet, it is the earliest placement', () => {
    const due: Room = { ...plainRoom(10), deadline: '2027-01-05' }
    expect(targetDays(due, hours(4), request())).toEqual(earliestDays(due, hours(4), request()))
  })
})

describe('reachOf', () => {
  test('cuts the room at the deadline when every session can be in time', () => {
    expect(reachOf(room, sessions, request()).days.map((d) => d.index)).toEqual([1, 2, 3])
  })

  test('otherwise keeps ten study days after the furthest day a session aims at', () => {
    const tight: Room = { ...room, days: room.days.map((d) => (d.index === 1 ? { ...d, cap: 2 } : d)) }
    expect(reachOf(tight, sessions, request()).days).toHaveLength(4)
    const pace = request({ target: { mode: 'pace', perDay: 1 } })
    expect(reachOf(plainRoom(40), hours(5), pace).days.at(-1)?.index).toBe(15)
  })
})

describe('buildModel', () => {
  test('puts a session only on days with room for it, and a lab only where two hours follow each other', () => {
    const { model } = buildModel(room, sessions, request())
    const days = (i: number) => names(model).filter((n) => n.startsWith(`y_${i}_`))
    expect(days(0)).toEqual(['y_0_1', 'y_0_3', 'y_0_4'])
    expect(days(1)).toEqual(['y_1_1', 'y_1_4'])
  })

  test('never puts a session before the earliest day it can reach in order', () => {
    // With two hours on the first day the lab cannot follow the first session there, so it reaches day 4 at best,
    // and the last session cannot come after it at all.
    const tight: Room = { ...room, days: room.days.map((d) => (d.index === 1 ? { ...d, cap: 2 } : d)) }
    const { model } = buildModel(tight, sessions, request())
    expect(names(model).filter((n) => n.startsWith('y_1_'))).toEqual(['y_1_4'])
    expect(names(model).filter((n) => n.startsWith('y_2_'))).toEqual([])
  })

  test('starts from the days the sessions aim at, or the earliest when those leave one out, meeting every row', () => {
    for (const overBudget of [false, true]) {
      for (const target of [{ mode: 'deadline' }, { mode: 'pace', perDay: 1 }] as const) {
        const { model, start } = buildModel(room, sessions, request({ overBudget, target }))
        expect(Object.keys(start).toSorted()).toEqual(names(model).toSorted())
        for (const { name, terms, op, rhs } of model.constraints) {
          const value = terms.reduce((total, { v, c }) => total + c * (start[v] ?? Number.NaN), 0)
          const ok = op === '=' ? Math.abs(value - rhs) < 1e-9 : op === '<=' ? value <= rhs + 1e-9 : value >= rhs - 1e-9
          expect(ok, `${name}: ${value} ${op} ${rhs}`).toBe(true)
        }
        expect([start.y_0_1, start.y_1_1, start.y_2_2]).toEqual([1, 1, 1])
      }
    }
  })

  test('a session outside the study hours may stay on its own day, outside the day room', () => {
    const { model } = buildModel(room, sessions, request())
    expect(names(model)).toContain('y_2_2')
    expect(row(model, 'room_2')).toBeUndefined()
    expect(row(model, 'room_1')?.terms.map((t) => t.v)).toEqual(['y_0_1', 'y_1_1'])
  })

  test('keeps the order of the sessions through running sums, and the unplaced ones are the tail', () => {
    const { model } = buildModel(room, sessions, request())
    // Y_i_d: session i is on day d or before. The next session can never be further along than this one.
    expect(row(model, 'reach_0_3')).toEqual({
      name: 'reach_0_3',
      terms: [
        { v: 'Y_0_3', c: 1 },
        { v: 'Y_0_2', c: -1 },
        { v: 'y_0_3', c: -1 },
      ],
      op: '=',
      rhs: 0,
    })
    expect(row(model, 'reach_1_2')?.terms).toEqual([
      { v: 'Y_1_2', c: 1 },
      { v: 'Y_1_1', c: -1 },
    ])
    expect(row(model, 'order_0_2')).toEqual({
      name: 'order_0_2',
      terms: [
        { v: 'Y_1_2', c: 1 },
        { v: 'Y_0_2', c: -1 },
      ],
      op: '<=',
      rhs: 0,
    })
    expect(row(model, 'order_1_4')).toBeDefined()
    expect(row(model, 'order_2_1')).toBeUndefined()
    expect(row(model, 'once_0')?.terms).toEqual([
      { v: 'Y_0_4', c: 1 },
      { v: 'u_0', c: 1 },
    ])
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

  test('towards a deadline a session pays its hours for each study day it lands away from its target', () => {
    // Targets: days 1, 1 and 2, the slowest rhythm before 15 December. The lab costs two hours a day off.
    const { levels } = buildModel(room, sessions, request())
    expect(levels[2]).toEqual([
      { v: 'y_0_3', c: 2 },
      { v: 'y_0_4', c: 3 },
      { v: 'y_1_4', c: 6 },
      { v: 'y_2_3', c: 1 },
      { v: 'y_2_4', c: 2 },
    ])
  })

  test('at a pace the target is the rhythm asked for, and a session it cannot place has none', () => {
    // One every two days: day 1, then the lab waits for day 4, and nothing fits after it.
    const { levels } = buildModel(room, sessions, request({ target: { mode: 'pace', perDay: 1 / 2 } }))
    expect(levels[1]).toEqual([
      { v: 'y_0_3', c: 2 },
      { v: 'y_0_4', c: 3 },
      { v: 'y_1_1', c: 6 },
    ])
  })

  test('towards a deadline: nothing unplaced, nothing late, the least over the budget, then the rhythm', () => {
    const { levels } = buildModel(room, sessions, request({ overBudget: true }))
    expect(levels.slice(0, 3)).toEqual([
      sum('u_0', 'u_1', 'u_2'),
      sum('late_0', 'late_1', 'late_2'),
      sum('over_1', 'over_2'),
    ])
    expect(levels[3]?.every(({ v }) => v.startsWith('y_'))).toBe(true)
    expect(levels.slice(4, 6)).toEqual([sum('Pw'), sum('Pd')])
    // The lab's own day has no two free hours, so only two sessions can keep their day.
    expect(levels.at(-2)).toEqual([
      { v: 'y_0_1', c: -1 },
      { v: 'y_2_2', c: -1 },
    ])
    expect(levels.at(-1)).toEqual(sum('t_0', 't_1', 't_2'))
  })

  test('at a pace: nothing unplaced, then the rhythm, and a level without terms is left out', () => {
    const { levels } = buildModel(room, sessions, request({ target: { mode: 'pace', perDay: 1 } }))
    expect(levels[1]?.every(({ v }) => v.startsWith('y_'))).toBe(true)
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
