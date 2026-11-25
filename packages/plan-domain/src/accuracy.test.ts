import { describe, expect, test } from 'vitest'

import { MIN_LOGGED, accuracyOf } from './accuracy'
import { mondayOf, parseLocal } from './dates'
import { applyEdits, emptyEdits } from './edits'
import { itemAt } from './fixtures'
import { paceForecast } from './forecast'
import { weekReview } from './goals'
import { courseProgress, doneWithoutTime, isSession, referenceClass } from './progress'
import { DEFAULT_CONFIG, buildPlan } from './schedule'
import type { Plan, PlanEvent } from './types'

const base = buildPlan(DEFAULT_CONFIG, '2026-11-22')
const certs = base.events.filter((e) => e.calendar === 'certs' && isSession(e) && e.kind === 'study')

/** The plan with the first certs sessions done: `minutes[i]` logged on the i-th, or none where it is undefined */
function finished(minutes: (number | undefined)[]): Plan {
  const events = Object.fromEntries(
    minutes.map((actual, i) => [certs[i]?.uid ?? '', actual === undefined ? { done: true } : { done: true, actual }]),
  )
  return applyEdits(base, { ...emptyEdits(), events }).plan
}
const sessionsOf = (plan: Plan): PlanEvent[] => plan.events.filter((e) => e.calendar === 'certs' && isSession(e))
const hourLong = (actuals: (number | undefined)[]) => accuracyOf(sessionsOf(finished(actuals)))
const certsOf = (plan: Plan) => courseProgress(plan).find((c) => c.calendar.id === 'certs')

describe('accuracyOf', () => {
  test('counts done sessions and those with a logged time apart', () => {
    expect(hourLong([90, undefined, 60])).toMatchObject({ done: 3, logged: 2, loggedPlanned: 2, loggedSpent: 2.5 })
  })

  test(`says nothing about the pace below ${MIN_LOGGED} logged sessions`, () => {
    expect(hourLong([120, 120, 120, 120, 120])).toMatchObject({ pace: null, typical: null })
  })

  test('takes the pace from the logged sessions alone: one not logged does not pull it to the plan', () => {
    const accuracy = hourLong([90, 90, 90, 90, 90, 90, undefined, undefined])
    expect(accuracy.pace).toBeCloseTo(1.5)
    expect(accuracy.ifPlanned).toBeCloseTo((9 + 2) / 8)
  })

  test('gives the typical session as the geometric mean of the ratios, with its 95% interval', () => {
    const { typical } = hourLong([30, 60, 60, 60, 60, 120])
    expect(typical?.ratio).toBeCloseTo(1)
    // ln-ratios −ln 2, 0, 0, 0, 0, ln 2: sd 0.4384, t(5) 2.571
    expect(typical?.low).toBeCloseTo(0.631, 2)
    expect(typical?.high).toBeCloseTo(1.584, 2)
  })

  test('the interval narrows as logged sessions agree', () => {
    const few = hourLong([45, 60, 75, 60, 45, 75]).typical
    const many = hourLong([45, 60, 75, 60, 45, 75, 45, 60, 75, 60, 45, 75]).typical
    expect((many?.high ?? 0) / (many?.low ?? 1)).toBeLessThan((few?.high ?? 0) / (few?.low ?? 1))
  })
})

describe('the pace a plan decides on', () => {
  test(`a course's pace stays at the plan until ${MIN_LOGGED} sessions are logged`, () => {
    expect(certsOf(finished([120, 120, 120]))?.pace).toBe(1)
    expect(certsOf(finished([90, 90, 90, 90, 90, 90, undefined]))?.pace).toBeCloseTo(1.5)
  })

  test('the forecast needs the logged pace for the hours that are left, not one diluted by unlogged sessions', () => {
    const plan = finished([90, 90, 90, 90, 90, 90, undefined, undefined])
    const forecast = paceForecast(plan, Date.parse('2026-11-23T09:00:00Z'), 'certs')
    expect(forecast.pace).toBeCloseTo(1.5)
    expect(forecast.needed).toBeCloseTo(forecast.remaining * 1.5)
  })
})

test('the week review counts the logged sessions of the week as well', () => {
  const plan = finished([75, undefined, 60])
  const first = certs[0]?.start ?? ''
  const review = weekReview(plan, mondayOf(parseLocal(first)), parseLocal(first) + 30 * 86_400_000)
  expect(review.accuracy).toMatchObject({ done: 3, logged: 2, pace: null })
})

test('a done session without a logged time is told apart from one with a time and from done personal time', () => {
  const plan = finished([75, undefined])
  const [logged, unlogged, open] = sessionsOf(plan)
  const gym = base.events.find((e) => e.kind === 'personal')
  expect([logged, unlogged, open].map((e) => e !== undefined && doneWithoutTime(e))).toEqual([false, true, false])
  expect(gym !== undefined && doneWithoutTime({ ...gym, done: true })).toBe(false)
})

/** The plan with these sessions done, each with its logged minutes. */
function loggedPlan(minutes: Map<PlanEvent, number>): Plan {
  const events = Object.fromEntries([...minutes].map(([e, actual]) => [e.uid, { done: true, actual }]))
  return applyEdits(base, { ...emptyEdits(), events }).plan
}
const studyOf = (calendar: string) => base.events.filter((e) => e.calendar === calendar && e.kind === 'study')
const eachTook = (sessions: PlanEvent[], actual: number) => sessions.map((e): [PlanEvent, number] => [e, actual])

describe('referenceClass', () => {
  const ahead = itemAt(certs)
  const done = certs.slice(1)

  test(`says nothing until ${MIN_LOGGED} sessions like it are logged`, () => {
    const plan = loggedPlan(new Map(eachTook(done.slice(0, MIN_LOGGED - 1), 75)))
    expect(referenceClass(plan, ahead)).toBeNull()
  })

  test('takes the same course and kind once that class is big enough', () => {
    const plan = loggedPlan(new Map(eachTook(done.slice(0, MIN_LOGGED), 75)))
    const like = referenceClass(plan, ahead)
    expect(like).toMatchObject({ scope: 'course', count: MIN_LOGGED })
    expect(like?.typical.ratio).toBeCloseTo(1.25)
  })

  test('falls back to the same kind in every course while the course has too few', () => {
    const other = studyOf('hfllm').slice(0, MIN_LOGGED - 2)
    const plan = loggedPlan(new Map([...eachTook(done.slice(0, 2), 90), ...eachTook(other, 60)]))
    expect(referenceClass(plan, ahead)).toMatchObject({ scope: 'kind', count: MIN_LOGGED })
  })

  test('leaves the session itself out, so a finished one is compared with the others', () => {
    const plan = loggedPlan(new Map([[ahead, 120], ...eachTook(done.slice(0, MIN_LOGGED), 60)]))
    const like = referenceClass(plan, ahead)
    expect(like?.count).toBe(MIN_LOGGED)
    expect(like?.typical.ratio).toBeCloseTo(1)
  })
})
