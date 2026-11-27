import { describe, expect, test } from 'vitest'

import { fixtureBase, itemAt } from '../fixtures'
import { paceForecast } from '../insights/forecast'
import { MIN_LOGGED, accuracyOf, runningTypical } from './accuracy'
import { applyChange, type PlanChange } from './changes'
import { mondayOf, parseLocal, toLocalString } from './dates'
import { applyEdits, emptyEdits, type PlanEdits } from './edits'
import { moduleOverruns, weekReview } from './goals'
import { courseProgress, doneWithoutTime, isSession, referenceClass } from './progress'
import type { Plan, PlanEvent } from './types'

const base = fixtureBase
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

const sessionsAt = (actuals: number[]) => sessionsOf(finished(actuals))

describe('runningTypical', () => {
  test(`starts at the ${MIN_LOGGED}th logged session`, () => {
    expect(runningTypical(sessionsAt([75, 75, 75, 75, 75]))).toEqual([])
    expect(runningTypical(sessionsAt([75, 75, 75, 75, 75, 75, 75, 75])).map((point) => point.count)).toEqual([6, 7, 8])
  })

  test('gives the typical session after each one, which settles as they agree', () => {
    const points = runningTypical(sessionsAt([60, 90, 60, 90, 60, 90, 60, 90, 60, 90, 60, 90]))
    const [first] = points
    const last = points.at(-1)
    if (!first || !last) throw new Error('No points')
    expect(last.typical.ratio).toBeCloseTo(Math.sqrt(1.5))
    expect(last.typical.high - last.typical.low).toBeLessThan(first.typical.high - first.typical.low)
  })

  test('orders the sessions by when they were really done, not by their plan', () => {
    const plan = finished([60, 60, 60, 60, 60, 60, 120])
    const [early] = certs
    if (!early) throw new Error('No session')
    // The first planned session was done last, on its own, after the others.
    const late = {
      ...plan,
      events: plan.events.map((e) => (e.uid === early.uid ? { ...e, began: '2027-01-01T10:00' } : e)),
    }
    const before = runningTypical(sessionsOf(plan)).map((point) => point.count)
    expect(before).toEqual([6, 7])
    const [sixth] = runningTypical(sessionsOf(late))
    expect(sixth?.typical.ratio).toBeCloseTo(2 ** (1 / 6))
  })
})

const planOf = (edits: PlanEdits) => applyEdits(base, edits).plan
const finish = (e: PlanEvent, actual: number, unfinished?: true): PlanChange => ({
  type: 'event.patch',
  uid: e.uid,
  patch: unfinished ? { done: true, actual, unfinished } : { done: true, actual },
})

describe('moduleOverruns', () => {
  const NOW = Date.parse('2026-11-23T09:00:00Z')
  const COUNTER = / \(\d+\/\d+\)$/
  const firstOfMany = itemAt(certs.filter((e) => / \(1\/\d+\)$/.test(e.title)))
  const moduleTitle = firstOfMany.title.replace(COUNTER, '')
  const sessions = certs.filter((e) => e.title.startsWith(`${moduleTitle} (`))
  const n = sessions.length
  const single = itemAt(certs.filter((e) => !COUNTER.test(e.title)))
  const after = (edits: PlanEdits, ...changes: PlanChange[]) =>
    changes.reduce((next, change) => applyChange(base, next, change, NOW), edits)
  const rowOf = (plan: Plan) => moduleOverruns(plan).find((row) => moduleTitle.endsWith(` — ${row.title}`))

  test('compares the hours logged on a module with the hours it was planned with, once every session is logged', () => {
    const row = rowOf(planOf(after(emptyEdits(), ...sessions.map((e, i) => finish(e, i ? 75 : 90)))))
    expect(row).toMatchObject({ sessions: n, done: n, planned: n, added: 0, unfinished: 0 })
    expect(row?.ratio).toBeCloseTo((90 + 75 * (n - 1)) / 60 / n)
  })

  test('gives no ratio while a session of the module is open or done without a time', () => {
    const [first, second] = sessions
    if (!first || !second) throw new Error('No module of two sessions')
    const plan = planOf(
      after(emptyEdits(), finish(first, 90), { type: 'event.patch', uid: second.uid, patch: { done: true } }),
    )
    expect(rowOf(plan)).toMatchObject({ done: 2, logged: 1, ratio: null })
  })

  test('a session added to the module later counts in its real hours, not in what it was planned with', () => {
    const last = itemAt(sessions, n - 1)
    const extra = { ...last, uid: 'custom-extra@learning-curve', start: '2027-03-01T10:00', end: '2027-03-01T11:00' }
    const edits = after(emptyEdits(), ...sessions.map((e) => finish(e, 60)))
    const row = rowOf(planOf({ ...edits, added: [{ ...extra, done: true, actual: 60 }] }))
    expect(row).toMatchObject({ sessions: n + 1, planned: n, spent: n + 1, added: 1 })
    expect(row?.ratio).toBeCloseTo((n + 1) / n)
  })

  test('a module made in the viewer was planned with the sessions it has: none of them counts as added', () => {
    const own = [1, 2].map((i) => ({
      ...single,
      uid: `custom-own-${i}@learning-curve`,
      title: `Свой курс — Своя тема (${i}/2)`,
      start: `2027-03-0${i}T10:00`,
      end: `2027-03-0${i}T11:00`,
      done: true,
      actual: 60,
    }))
    const row = moduleOverruns(planOf({ ...emptyEdits(), added: own })).find((r) => r.title === 'Своя тема')
    expect(row).toMatchObject({ sessions: 2, planned: 2, added: 0, ratio: 1 })
  })

  test('the parts of a split session share the length it was planned with', () => {
    const { uid, start } = firstOfMany
    const later = (minutes: number) => toLocalString(parseLocal(start) + minutes * 60_000)
    const split = after(emptyEdits(), {
      type: 'event.split',
      uid,
      parts: [
        { start, end: later(30) },
        { start: later(240), end: later(270) },
      ],
    })
    const part = itemAt(planOf(split).events.filter((e) => e.from === uid))
    const row = rowOf(planOf(after(split, ...[...sessions, part].map((e) => finish(e, 60)))))
    expect(row).toMatchObject({ sessions: n + 1, planned: n, added: 0 })
  })

  test('a session made longer counts at the length it was first planned with', () => {
    const { uid, start } = firstOfMany
    const end = toLocalString(parseLocal(start) + 2 * 3_600_000)
    const edits = after(
      emptyEdits(),
      { type: 'event.patch', uid, patch: { end } },
      ...sessions.map((e) => finish(e, 60)),
    )
    expect(rowOf(planOf(edits))).toMatchObject({ planned: n, ratio: 1 })
  })

  test('a module whose last session ran out of time waits for the rest', () => {
    const changes = sessions.map((e, i) => finish(e, 60, i === n - 1 ? true : undefined))
    expect(rowOf(planOf(after(emptyEdits(), ...changes)))).toMatchObject({ ratio: null, unfinished: 1 })
  })

  test('ranks the modules from the longest overrun down, those without a ratio last', () => {
    const other = (e: PlanEvent) => ![moduleTitle, single.title].includes(e.title.replace(COUNTER, ''))
    const open = itemAt(certs.filter(other))
    const edits = after(emptyEdits(), ...sessions.map((e) => finish(e, 90)), finish(single, 45), {
      type: 'event.patch',
      uid: open.uid,
      patch: { done: true },
    })
    expect(moduleOverruns(planOf(edits)).map((row) => row.ratio)).toEqual([1.5, 0.75, null])
  })
})
