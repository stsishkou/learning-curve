import { expect, test } from 'vitest'

import { DAY, parseLocal, startOfDay } from './dates'
import { fixtureNow, fixturePlan } from './fixtures'
import { isSession } from './progress'
import { studyStreak } from './streak'

test('every past study day of the fixture is done, so the run is as long as those days', () => {
  const streak = studyStreak(fixturePlan, fixtureNow)
  const studied = streak.days.filter((d) => d.day <= startOfDay(fixtureNow) && d.done > 0)
  expect(streak.current).toBe(studied.length)
  expect(streak.best).toBe(streak.current)
  expect(streak.days.length % 7).toBe(0)
})

test('a missed study day ends the run and a day with no session does not', () => {
  const missed = fixturePlan.events.find((e) => isSession(e) && e.done)
  if (!missed) throw new Error('The fixture has no done session')
  const day = startOfDay(parseLocal(missed.start))
  const plan = {
    ...fixturePlan,
    events: fixturePlan.events.map((e) =>
      isSession(e) && startOfDay(parseLocal(e.start)) === day ? { ...e, done: false } : e,
    ),
  }
  const before = studyStreak(fixturePlan, fixtureNow)
  const after = studyStreak(plan, fixtureNow)
  expect(after.current).toBeLessThan(before.current)
  expect(studyStreak(fixturePlan, fixtureNow + 3 * DAY).current).toBeLessThanOrEqual(before.current)
})
