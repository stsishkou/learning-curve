import {
  movingSessions,
  parseLocal,
  planRebalance,
  roomOf,
  type Plan,
  type PlanEvent,
  type RebalanceRequest,
  type RebalanceTarget,
  type SessionMove,
} from '@lc/plan-domain'
import { describe, expect, test } from 'vitest'

import { solveLp } from './solver'

/*
 * The worked example of docs/rebalancing.md, run with the real solver. The document quotes every number asserted
 * here: change one, change the other.
 */

const at = (day: string, from: string, to: string) => ({ start: `${day}T${from}`, end: `${day}T${to}` })

const event = (calendar: string, uid: string, slot: { start: string; end: string }, kind: 'study' | 'lab') => ({
  uid,
  calendar,
  title: `${calendar} ${uid}`,
  description: '',
  kind,
  availability: 'busy' as const,
  ...slot,
})

const course = (uid: string, slot: { start: string; end: string }, kind: 'study' | 'lab' = 'study'): PlanEvent =>
  event('course', uid, slot, kind)

/** Three sessions, a gap of a week and a half, then a crunch of three; another calendar holds two Tuesday noons. */
const plan: Plan = {
  meta: {
    title: 'Worked example',
    version: 1,
    timezone: 'Europe/Minsk',
    generated: '2027-01-01',
    weeklyBudgetHours: 6,
    holidays: ['2027-01-07'],
    planEnd: '2027-12-31',
  },
  calendars: [
    { id: 'course', name: 'Course', color: '#2F5BEA', isNew: false },
    { id: 'talks', name: 'Talks', color: '#0F9D58', isNew: false },
  ],
  events: [
    course('s1', at('2027-01-04', '11:00', '12:00')),
    course('s2', at('2027-01-05', '11:00', '12:00')),
    course('s3', at('2027-01-06', '11:00', '12:00')),
    course('s4', at('2027-01-18', '11:00', '13:00'), 'lab'),
    course('s5', at('2027-01-19', '11:00', '12:00')),
    course('s6', at('2027-01-20', '11:00', '12:00')),
    event('talks', 't1', at('2027-01-05', '12:00', '13:00'), 'study'),
    event('talks', 't2', at('2027-01-12', '12:00', '13:00'), 'study'),
  ],
}

const NOW = parseLocal('2027-01-04T08:00')

const ask = (target: RebalanceTarget, deadline?: string): RebalanceRequest => ({
  calendar: 'course',
  from: '2027-01-04',
  deadline,
  target,
  overBudget: false,
  hours: { from: '11:00', to: '14:00' },
})

const rebalance = (on: Plan, request: RebalanceRequest) => planRebalance(on, request, NOW, [], solveLp)

const withMoves = (on: Plan, moves: SessionMove[]): Plan => {
  const to = new Map(moves.map((m) => [m.uid, m]))
  return { ...on, events: on.events.map((e) => ({ ...e, ...to.get(e.uid) })) }
}

describe('the worked example of docs/rebalancing.md', () => {
  test('the room: Tuesdays lose their noon and their lab block, and each of the first two weeks has 5 h left', () => {
    const request = ask({ mode: 'pace', perDay: 0.5 })
    const room = roomOf(plan, request, movingSessions(plan, request), NOW, [])
    expect(room.days.slice(0, 9).map(({ day, index, cap, lab }) => ({ day, index, cap, lab }))).toEqual([
      { day: '2027-01-04', index: 1, cap: 3, lab: true },
      { day: '2027-01-05', index: 2, cap: 2, lab: false },
      { day: '2027-01-06', index: 3, cap: 3, lab: true },
      { day: '2027-01-08', index: 4, cap: 3, lab: true },
      { day: '2027-01-11', index: 5, cap: 3, lab: true },
      { day: '2027-01-12', index: 6, cap: 2, lab: false },
      { day: '2027-01-13', index: 7, cap: 3, lab: true },
      { day: '2027-01-14', index: 8, cap: 3, lab: true },
      { day: '2027-01-15', index: 9, cap: 3, lab: true },
    ])
    expect(Object.fromEntries([...room.weeks].slice(0, 3))).toEqual({
      '2027-01-04': { left: 5, fixed: 1 },
      '2027-01-11': { left: 5, fixed: 1 },
      '2027-01-18': { left: 6, fixed: 0 },
    })
  })

  test('towards a deadline of 15 January the crunch comes forward, evenly, and the first three stay', async () => {
    const { moves, report } = await rebalance(plan, ask({ mode: 'deadline' }, '2027-01-15'))
    expect(moves).toEqual([
      { uid: 's4', ...at('2027-01-11', '11:00', '13:00') },
      { uid: 's5', ...at('2027-01-13', '11:00', '12:00') },
      { uid: 's6', ...at('2027-01-14', '11:00', '12:00') },
    ])
    expect(report).toEqual({
      finish: '2027-01-14',
      finishBefore: '2027-01-20',
      deadline: '2027-01-15',
      peakWeek: 5,
      peakDay: 2,
      overWeeks: [],
      moved: 3,
      late: 0,
      unplaced: 0,
      provenBest: true,
      reasons: [],
    })
  })

  test('at one session every two study days the crunch spreads out and the course still ends on 20 January', async () => {
    const { moves, report } = await rebalance(plan, ask({ mode: 'pace', perDay: 0.5 }))
    expect(moves).toEqual([
      { uid: 's2', ...at('2027-01-06', '11:00', '12:00') },
      { uid: 's3', ...at('2027-01-11', '11:00', '12:00') },
      { uid: 's4', ...at('2027-01-13', '11:00', '13:00') },
      { uid: 's5', ...at('2027-01-18', '11:00', '12:00') },
    ])
    expect(report).toMatchObject({ finish: '2027-01-20', finishBefore: '2027-01-20', peakWeek: 4, peakDay: 2 })
    expect(report).toMatchObject({ moved: 4, late: 0, unplaced: 0, provenBest: true, reasons: [] })
  })

  test('asking the same again moves nothing', async () => {
    for (const request of [ask({ mode: 'deadline' }, '2027-01-15'), ask({ mode: 'pace', perDay: 0.5 })]) {
      // oxlint-disable-next-line no-await-in-loop -- the second ask needs the first answer
      const { moves } = await rebalance(plan, request)
      // oxlint-disable-next-line no-await-in-loop -- one request at a time, as the server runs them
      const again = await rebalance(withMoves(plan, moves), request)
      expect(again.moves).toEqual([])
    }
  })
})
