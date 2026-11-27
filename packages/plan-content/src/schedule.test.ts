import { isPlan } from '@lc/plan-domain'
import { expect, test } from 'vitest'

import { DEFAULT_CONFIG, buildPlan } from './schedule'

test('the generated plan is a plan and every event is in one of its calendars', () => {
  const plan = buildPlan(DEFAULT_CONFIG, '2026-11-22')
  expect(isPlan(plan)).toBe(true)
  const calendars = new Set(plan.calendars.map((c) => c.id))
  expect(plan.events.every((e) => calendars.has(e.calendar))).toBe(true)
})
