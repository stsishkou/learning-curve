import { describe, expect, test } from 'vitest'

import { MIN_LOGGED } from '../core/accuracy'
import { parseLocal, ymd } from '../core/dates'
import { applyEdits, emptyEdits, type EventPatch } from '../core/edits'
import { isSession } from '../core/progress'
import { DEFAULT_CONFIG, buildPlan } from '../core/schedule'
import type { Plan } from '../core/types'
import { planBrief } from '../protocol/guide'
import { accuracyReport } from './accuracy-report'
import { finishRange, paceForecast } from './forecast'

const base = buildPlan(DEFAULT_CONFIG, '2026-11-22')
const before = parseLocal('2026-11-22T00:00')
const certs = base.events.filter((e) => e.calendar === 'certs' && isSession(e) && e.kind === 'study')

/** The first `logged` certs study sessions done in 90 minutes each, and the next `unlogged` done without a time. */
function planOf(logged: number, unlogged = 0): Plan {
  const events = Object.fromEntries([
    ...certs.slice(0, logged).map((e): [string, EventPatch] => [e.uid, { done: true, actual: 90 }]),
    ...certs.slice(logged, logged + unlogged).map((e): [string, EventPatch] => [e.uid, { done: true }]),
  ])
  return applyEdits(base, { ...emptyEdits(), events }).plan
}

const courseOf = (plan: Plan, calendar: string) =>
  accuracyReport(plan, before).courses.find((c) => c.calendar === calendar)

describe('accuracyReport', () => {
  test('gives each course its counts, pace and typical session, the done sessions without a time apart', () => {
    const name = base.calendars.find((c) => c.id === 'certs')?.name
    expect(courseOf(planOf(MIN_LOGGED, 1), 'certs')).toMatchObject({
      name,
      done: MIN_LOGGED + 1,
      logged: MIN_LOGGED,
      unlogged: 1,
      pace: 1.5,
      typical: { ratio: 1.5, low: 1.5, high: 1.5 },
    })
  })

  test(`says no ratio below ${MIN_LOGGED} logged sessions`, () => {
    expect(courseOf(planOf(MIN_LOGGED - 1), 'certs')).toMatchObject({
      logged: MIN_LOGGED - 1,
      pace: null,
      typical: null,
    })
    expect(courseOf(planOf(MIN_LOGGED), 'hfllm')).toMatchObject({ logged: 0, pace: null, typical: null })
  })

  test('gives the reference classes of a new session: its kind in its course, and its kind in every course', () => {
    const report = accuracyReport(planOf(MIN_LOGGED), before, 'hfllm')
    const study = report.kinds.find((k) => k.kind === 'study')
    expect(study).toMatchObject({ logged: MIN_LOGGED, typical: { ratio: 1.5 } })
    const own = report.courses.at(0)?.kinds.find((k) => k.kind === 'study')
    expect(own).toMatchObject({ logged: 0, typical: null })
  })

  test('narrows the courses to one calendar', () => {
    expect(accuracyReport(planOf(MIN_LOGGED), before, 'certs').courses.map((c) => c.calendar)).toEqual(['certs'])
  })

  test("gives each course's finish as days: as planned, at its pace and as a range", () => {
    const plan = planOf(MIN_LOGGED)
    const forecast = paceForecast(plan, before, 'certs')
    const range = finishRange(plan, before, { calendar: 'certs' })
    expect(courseOf(plan, 'certs')).toMatchObject({
      hoursLeft: Math.round(forecast.remaining * 10) / 10,
      plannedFinish: forecast.planned === null ? null : ymd(forecast.planned),
      forecastFinish: forecast.finish === null ? null : ymd(forecast.finish),
      range: range && { likely: ymd(range.likely), late: ymd(range.late), scope: range.scope },
    })
    expect(range).not.toBeNull()
  })

  test('a brief carries the report, so a chat reads the same numbers as the tools', () => {
    const plan = planOf(MIN_LOGGED)
    expect(planBrief(plan, before)).toContain(
      `<accuracy>\n${JSON.stringify(accuracyReport(plan, before))}\n</accuracy>`,
    )
  })
})
