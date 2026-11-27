import { describe, expect, test } from 'vitest'

import { MIN_LOGGED } from '../core/accuracy'
import { DAY, HOUR, parseLocal, toLocalString } from '../core/dates'
import { applyEdits, emptyEdits, type EventPatch } from '../core/edits'
import { isSession } from '../core/progress'
import type { Plan, PlanEvent } from '../core/types'
import { fixtureBase } from '../fixtures'
import { finishRange, paceForecast } from './forecast'

const base = fixtureBase
const before = parseLocal('2026-11-22T00:00')
const studyOf = (calendar: string) =>
  base.events.filter((e) => e.calendar === calendar && isSession(e) && e.kind === 'study')
const certs = studyOf('certs')
const minutesOf = (e: PlanEvent) => (parseLocal(e.end) - parseLocal(e.start)) / 60_000

/** These sessions done, each logged at its planned length times the ratio paired with it. */
const took = (sessions: PlanEvent[], ratios: number[]) =>
  sessions.map((e, i): [string, EventPatch] => [
    e.uid,
    { done: true, actual: Math.round(minutesOf(e) * (ratios[i % ratios.length] ?? 1)) },
  ])

const planOf = (...patches: [string, EventPatch][][]): Plan =>
  applyEdits(base, { ...emptyEdits(), events: Object.fromEntries(patches.flat()) }).plan

describe('finishRange', () => {
  test(`says nothing while fewer than ${MIN_LOGGED} sessions are logged in all`, () => {
    const plan = planOf(took(certs.slice(0, MIN_LOGGED - 1), [2]))
    expect(finishRange(plan, before, { calendar: 'certs' })).toBeNull()
    expect(finishRange(plan, before)).toBeNull()
  })

  test('without spread in its own logged times, both ends are the day the pace forecast gives', () => {
    const plan = planOf(took(certs.slice(0, MIN_LOGGED), [2]), took(studyOf('hfllm').slice(0, MIN_LOGGED), [1]))
    const range = finishRange(plan, before, { calendar: 'certs' })
    const day = paceForecast(plan, before, 'certs').finish
    expect(range).toEqual({ likely: day, late: day, scope: 'course' })
  })

  test('a spread puts nine in ten of the futures later than half of them', () => {
    const plan = planOf(took(certs.slice(0, MIN_LOGGED), [1, 3]))
    const range = finishRange(plan, before, { calendar: 'certs' })
    expect(range?.late).toBeGreaterThan(range?.likely ?? Infinity)
  })

  test('a long session weighs as much in the draw as the hours it covers, so the middle stays with the pace', () => {
    const [long, ...short] = certs.slice(0, MIN_LOGGED)
    const longer: [string, EventPatch][] = long
      ? [[long.uid, { end: toLocalString(parseLocal(long.start) + 5 * HOUR), done: true, actual: 5 * 60 * 3 }]]
      : []
    const plan = planOf(longer, took(short, [1]))
    const likely = finishRange(plan, before, { calendar: 'certs' })?.likely ?? 0
    expect(Math.abs(likely - (paceForecast(plan, before, 'certs').finish ?? 0))).toBeLessThanOrEqual(7 * DAY)
  })

  test('the fewer the logged sessions, the less sure the range: it carries the doubt about their typical ratio', () => {
    // The calendar is the same: certs has none logged and draws from 24 done hfllm sessions, of which 6 or all are logged.
    const done = studyOf('hfllm').slice(0, 4 * MIN_LOGGED)
    const width = (count: number) => {
      const unlogged = done.slice(count).map((e): [string, EventPatch] => [e.uid, { done: true }])
      const plan = planOf(took(done.slice(0, count), [1, 3]), unlogged)
      const range = finishRange(plan, before, { calendar: 'certs' })
      return (range?.late ?? 0) - (range?.likely ?? 0)
    }
    expect(width(MIN_LOGGED)).toBeGreaterThan(1.25 * width(4 * MIN_LOGGED))
  })

  test('the same seed gives the same range', () => {
    const plan = planOf(took(certs.slice(0, MIN_LOGGED), [1, 1.5, 3]))
    expect(finishRange(plan, before, { seed: 7 })).toEqual(finishRange(plan, before, { seed: 7 }))
  })

  test('a course with too few logged sessions of its own draws from those of every course', () => {
    const plan = planOf(took(certs.slice(0, MIN_LOGGED), [2]))
    const range = finishRange(plan, before, { calendar: 'hfllm' })
    expect(range?.scope).toBe('all')
    // At the plan's pace, which the course still has, it would end on its last planned day.
    expect(range?.likely).toBeGreaterThan(paceForecast(plan, before, 'hfllm').finish ?? Infinity)
    expect(finishRange(plan, before)?.scope).toBe('all')
  })

  test('a paced session already holds its pace: only the spread around it is drawn', () => {
    const paced = certs.slice(MIN_LOGGED).map((e): [string, EventPatch] => [e.uid, { paced: true }])
    const plan = planOf(took(certs.slice(0, MIN_LOGGED), [2]), paced)
    const day = paceForecast(plan, before, 'certs').finish
    expect(finishRange(plan, before, { calendar: 'certs' })).toMatchObject({ likely: day, late: day })
  })

  test('logged times older than about six months drop out', () => {
    const later = parseLocal('2027-07-01T00:00')
    const plan = planOf(took(certs.slice(0, MIN_LOGGED), [3]), took(studyOf('pypy').slice(-MIN_LOGGED), [1]))
    const range = finishRange(plan, later, { calendar: 'certs' })
    expect(range?.scope).toBe('all')
    expect(range?.late).toBe(range?.likely)
  })
})
