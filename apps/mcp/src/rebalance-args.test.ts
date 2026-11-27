import { DEFAULT_CONFIG, buildPlan } from '@lc/plan-content'
import { DAY, HOUR, parseLocal, toLocalString, weekday, type Plan, type PlanEvent } from '@lc/plan-domain'
import { defaultStudyHours } from '@lc/plan-domain/rebalance'
import { describe, expect, test } from 'vitest'

import { requestFromTool } from './rebalance-args'

const MONDAY = parseLocal('2026-12-07T00:00')

const event = (calendar: string, uid: string, start: number, length: number, extra: Partial<PlanEvent> = {}) => ({
  uid,
  calendar,
  title: `${calendar} ${uid}`,
  start: toLocalString(start),
  end: toLocalString(start + length),
  description: '',
  kind: 'study' as const,
  availability: 'busy' as const,
  ...extra,
})

const planOf = (events: PlanEvent[], holidays: string[] = [], calendars = 3): Plan => ({
  meta: {
    title: 'Generated',
    version: 1,
    timezone: 'Europe/Minsk',
    generated: '2026-11-22',
    weeklyBudgetHours: 12,
    holidays,
    planEnd: '2027-12-31',
  },
  calendars: Array.from({ length: calendars }, (_, i) => ({
    id: `c${i}`,
    name: `Course ${i}`,
    color: '#2F5BEA',
    isNew: false,
  })),
  events,
})

/** `count` sessions of `c0`, one a weekday from `from`, a lab now and then. */
function course(count: number, next: () => number, from = MONDAY): PlanEvent[] {
  const sessions: PlanEvent[] = []
  let day = from
  for (let i = 0; i < count; i++) {
    while (weekday(day) % 6 === 0) day += DAY
    const lab = next() < 0.15
    const hour = lab ? 11 : 11 + Math.floor(next() * 3)
    sessions.push(
      event('c0', `c0-${String(i).padStart(3, '0')}`, day + hour * HOUR, (lab ? 2 : 1) * HOUR, {
        kind: lab ? 'lab' : 'study',
      }),
    )
    day += DAY
  }
  return sessions
}

describe('requestFromTool', () => {
  test('the MCP arguments map to a request', () => {
    const plan = buildPlan(DEFAULT_CONFIG, '2026-11-22')
    expect(requestFromTool({ calendar: 'hfllm', from: '2027-01-04', mode: 'rhythm', perDay: 0.5 }, plan)).toEqual({
      calendar: 'hfllm',
      from: '2027-01-04',
      deadline: undefined,
      target: { mode: 'rhythm', perDay: 0.5 },
      overBudget: false,
      hours: defaultStudyHours(plan),
    })
    expect(
      requestFromTool(
        {
          calendar: 'hfllm',
          from: '2027-01-04',
          mode: 'deadline',
          deadline: '2027-02-16',
          overBudget: true,
          hoursTo: '15:00',
        },
        plan,
      ),
    ).toMatchObject({
      target: { mode: 'deadline' },
      deadline: '2027-02-16',
      overBudget: true,
      hours: { from: defaultStudyHours(plan).from, to: '15:00' },
    })
  })

  test('the deadline mode without a deadline anywhere is refused', () => {
    const plan = planOf(course(5, () => 0.5))
    expect(() => requestFromTool({ calendar: 'c0', from: '2026-12-07', mode: 'deadline' }, plan)).toThrow(
      'The deadline mode needs a deadline',
    )
  })
})
