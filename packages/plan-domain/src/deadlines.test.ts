import { describe, expect, test } from 'vitest'

import { parseLocal } from './dates'
import { deadlineEvent, deadlineOf, nextDeadline } from './deadlines'
import { fixturePlan, itemAt } from './fixtures'
import { planOutlook } from './replan'
import type { Plan, PlanEvent } from './types'

const milestone = (calendar: string, day: string, uid = `m-${calendar}-${day}`): PlanEvent => ({
  uid,
  calendar,
  title: `Дедлайн: ${calendar}`,
  start: `${day}T00:00`,
  end: `${day}T00:00`,
  allDay: true,
  kind: 'milestone',
  availability: 'free',
  description: '',
})

const certsDay = itemAt(fixturePlan.events.filter((e) => e.kind === 'milestone' && e.calendar === 'certs')).start.slice(
  0,
  10,
)
const withEvents = (events: PlanEvent[]): Plan => ({ ...fixturePlan, events: [...fixturePlan.events, ...events] })
const withoutMilestones: Plan = { ...fixturePlan, events: fixturePlan.events.filter((e) => e.kind !== 'milestone') }

describe('deadlineEvent', () => {
  test('is the earliest milestone of the calendar, the one its deadline is read from', () => {
    const plan = withEvents([milestone('hfllm', '2027-03-01'), milestone('hfllm', '2027-02-15')])
    expect(deadlineEvent(plan, 'hfllm')?.uid).toBe('m-hfllm-2027-02-15')
    expect(deadlineEvent(fixturePlan, 'hfllm')).toBeNull()
  })
})

describe('deadlineOf', () => {
  test('is the day of the calendar milestone', () => {
    expect(deadlineOf(fixturePlan, 'certs')).toBe(certsDay)
  })

  test('is null for a calendar without a milestone', () => {
    expect(deadlineOf(fixturePlan, 'hfllm')).toBeNull()
  })

  test('takes the earlier of two milestones in one calendar', () => {
    const plan = withEvents([milestone('hfllm', '2027-03-01'), milestone('hfllm', '2027-02-15')])
    expect(deadlineOf(plan, 'hfllm')).toBe('2027-02-15')
  })
})

describe('nextDeadline', () => {
  test('is the nearest deadline from today on, across calendars', () => {
    const plan = withEvents([milestone('hfllm', '2026-12-10')])
    expect(nextDeadline(plan, parseLocal('2026-12-02T12:00'))).toEqual({ calendar: 'hfllm', day: '2026-12-10' })
  })

  test('counts a deadline that is today', () => {
    expect(nextDeadline(fixturePlan, parseLocal(`${certsDay}T15:00`))).toEqual({ calendar: 'certs', day: certsDay })
  })

  test('skips deadlines that are over and is null when none is ahead', () => {
    expect(nextDeadline(fixturePlan, parseLocal('2027-06-01T09:00'))).toBeNull()
  })
})

describe('planOutlook', () => {
  test('has no deadline margin in a plan without deadlines', () => {
    expect(planOutlook(withoutMilestones, parseLocal('2026-12-02T12:00')).deadlineMargin).toBeNull()
  })

  test('measures the margin to the nearest deadline from its calendar', () => {
    const now = parseLocal('2026-12-02T12:00')
    const lastCert = fixturePlan.events
      .filter((e) => e.calendar === 'certs' && e.kind !== 'milestone' && !e.done)
      .map((e) => e.start.slice(0, 10))
      .toSorted()
      .at(-1)
    const days = (parseLocal(`${certsDay}T00:00`) - parseLocal(`${lastCert ?? certsDay}T00:00`)) / 86_400_000
    expect(planOutlook(fixturePlan, now).deadlineMargin).toBe(days)
  })
})
