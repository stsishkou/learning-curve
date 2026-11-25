import { expect, test } from 'vitest'

import { DAY, parseLocal } from './dates'
import { isSession } from './progress'
import { catchUpScenarios } from './replan'
import { DEFAULT_CONFIG, buildPlan } from './schedule'

const plan = buildPlan(DEFAULT_CONFIG)

test('squeeze names the missed sessions it found no room for, the latest ones, and moves the rest', () => {
  const sessions = plan.events.filter(isSession).toSorted((a, b) => a.start.localeCompare(b.start))
  const first = sessions.at(0)
  if (!first) throw new Error('The plan has no sessions')
  // Two months in with nothing done: more is missed than the buffers and spare hours ahead can take.
  const now = parseLocal(first.start) + 60 * DAY
  const missed = sessions.filter((e) => parseLocal(e.end) <= now).map((e) => e.uid)
  const squeeze = catchUpScenarios(plan, now).find((scenario) => scenario.id === 'squeeze')
  const unplaced = squeeze?.unplaced ?? []
  const cut = missed.length - unplaced.length
  expect(unplaced.length).toBeGreaterThan(0)
  expect(squeeze?.moves.map((move) => move.uid)).toEqual(missed.slice(0, cut))
  expect(unplaced).toEqual(missed.slice(cut))
})
