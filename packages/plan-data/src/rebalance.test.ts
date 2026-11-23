import {
  DAY,
  DEFAULT_CONFIG,
  HOUR,
  PACES,
  buildPlan,
  mondayOf,
  movingSessions,
  occurrences,
  parseLocal,
  planRebalance,
  roomOf,
  toLocalString,
  weekday,
  weeklyHours,
  ymd,
  type BusyBlock,
  type Plan,
  type PlanEvent,
  type RebalanceRequest,
  type RebalanceResult,
  type SessionMove,
} from '@lc/plan-domain'
import { itemAt } from '@lc/plan-domain/fixtures'
import { describe, expect, test } from 'vitest'

import { solveLp } from './solver'

const MONDAY = parseLocal('2026-12-07T00:00')
const BEFORE_IT = parseLocal('2026-12-07T08:00')

/** A small seeded generator (mulberry32), so every failing case can be replayed. */
function random(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

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

/** A plan of 2–4 calendars: `c0` is re-balanced, the others are fixed ground, with holidays now and then. */
function generated(seed: number): { plan: Plan; request: RebalanceRequest } {
  const next = random(seed)
  const calendars = 2 + Math.floor(next() * 3)
  const sessions = course(10 + Math.floor(next() * 31), next)
  const fixed: PlanEvent[] = []
  for (let c = 1; c < calendars; c++) {
    for (let k = 0; k < 20; k++) {
      const day = MONDAY + Math.floor(next() * 70) * DAY
      if (weekday(day) % 6 === 0) continue
      const hour = 9 + Math.floor(next() * 7)
      fixed.push(
        event(`c${c}`, `c${c}-${k}`, day + hour * HOUR, HOUR, { availability: next() < 0.2 ? 'free' : 'busy' }),
      )
    }
  }
  const holidays = Array.from({ length: Math.floor(next() * 3) }, () => ymd(MONDAY + Math.floor(next() * 40) * DAY))
  const deadlineMode = next() < 0.5
  const perDay = itemAt(PACES, Math.floor(next() * PACES.length))
  const request: RebalanceRequest = {
    calendar: 'c0',
    from: '2026-12-07',
    deadline: deadlineMode ? ymd(MONDAY + Math.ceil(sessions.length * 1.2) * DAY) : undefined,
    target: deadlineMode ? { mode: 'deadline' } : { mode: 'pace', perDay },
    overBudget: next() < 0.3,
    hours: next() < 0.5 ? { from: '11:00', to: '14:00' } : { from: '10:00', to: '15:00' },
  }
  return { plan: planOf([...sessions, ...fixed], holidays, calendars), request }
}

const rebalance = (plan: Plan, request: RebalanceRequest, now = BEFORE_IT, busy: BusyBlock[] = []) =>
  planRebalance(plan, request, now, busy, solveLp)

const withMoves = (plan: Plan, moves: SessionMove[]): Plan => {
  const to = new Map(moves.map((m) => [m.uid, m]))
  return {
    ...plan,
    events: plan.events.map((e) => {
      const move = to.get(e.uid)
      return move ? { ...e, start: move.start, end: move.end } : e
    }),
  }
}

const minutesOf = (hhmm: string) => (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))) * 60_000

/** Every rule a re-balanced calendar must keep, checked on the plan with the moves applied. */
function expectValid(plan: Plan, request: RebalanceRequest, result: RebalanceResult, now: number, busy: BusyBlock[]) {
  const before = movingSessions(plan, request)
  const after = withMoves(plan, result.moves)
  const moving = new Set(before.map((e) => e.uid))
  const sessions = after.events.filter((e) => moving.has(e.uid))
  const moved = new Set(result.moves.map((m) => m.uid))

  // The order of the course is kept.
  const byStart = sessions.toSorted((a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid))
  expect(byStart.map((e) => e.uid)).toEqual(before.map((e) => e.uid))

  const used = new Set(before.map((e) => weekday(parseLocal(e.start))))
  const weekdays = [...used].some((d) => d % 6 !== 0)
  const away = new Set(busy.filter((b) => b.allDay).map((b) => ymd(b.s)))
  const end = parseLocal('2028-01-01T00:00')
  const others = occurrences(after, MONDAY, end, new Set()).filter(
    (o) => !moving.has(o.uid) && !o.allDay && o.availability !== 'free',
  )
  for (const e of sessions.filter((s) => moved.has(s.uid))) {
    const s = parseLocal(e.start)
    const t = parseLocal(e.end)
    const day = ymd(s)
    expect(after.meta.holidays, e.uid).not.toContain(day)
    expect(away.has(day), e.uid).toBe(false)
    expect(weekday(s) % 6 === 0 ? used.has(weekday(s)) : weekdays, `${e.uid} on ${day}`).toBe(true)
    expect(s, e.uid).toBeGreaterThanOrEqual(now)
    const dayStart = parseLocal(`${day}T00:00`)
    expect(s - dayStart, e.uid).toBeGreaterThanOrEqual(minutesOf(request.hours.from))
    expect(t - dayStart, e.uid).toBeLessThanOrEqual(minutesOf(request.hours.to))
    const clash = [...others, ...busy.filter((b) => !b.allDay)].find((o) => o.s < t && s < o.e)
    expect(clash, `${e.uid} at ${e.start}`).toBeUndefined()
    const twin = sessions.find((o) => o.uid !== e.uid && o.start < e.end && e.start < o.end)
    expect(twin, `${e.uid} at ${e.start}`).toBeUndefined()
  }

  if (!request.overBudget && result.report.unplaced === 0) {
    const total = weeklyHours(after)
    const without = weeklyHours({ ...after, events: after.events.filter((e) => !moving.has(e.uid)) })
    for (const [week, hours] of Object.entries(total)) {
      if (week < ymd(mondayOf(MONDAY))) continue
      expect(hours, week).toBeLessThanOrEqual(Math.max(12, without[week] ?? 0) + 1e-6)
    }
  }
}

const SEEDS = [1, 2, 3, 4, 5, 6]

// A level may take its two seconds, and a case solves up to three rounds of them.
describe('planRebalance on generated plans', { timeout: 20_000 }, () => {
  test.each(SEEDS)('seed %i keeps the order, the room, the budget and the study hours', async (seed) => {
    const { plan, request } = generated(seed)
    const result = await rebalance(plan, request)
    expectValid(plan, request, result, BEFORE_IT, [])
  })

  test.each(SEEDS.slice(0, 3))('seed %i: asking again moves nothing, and the same answer comes twice', async (seed) => {
    const { plan, request } = generated(seed)
    const first = await rebalance(plan, request)
    expect(await rebalance(plan, request)).toEqual(first)
    const again = await rebalance(withMoves(plan, first.moves), request)
    if (first.report.unplaced === 0) expect(again.moves).toEqual([])
  })
})

describe('planRebalance in particular cases', () => {
  test('never on another busy event, a holiday, a day away or a weekend the course does not use', async () => {
    const next = random(42)
    const sessions = course(12, next)
    const meeting = event('c1', 'meeting', parseLocal('2026-12-08T11:00'), 3 * HOUR)
    const plan = planOf([...sessions, meeting], ['2026-12-09'])
    const busy: BusyBlock[] = [
      { title: 'Trip', s: parseLocal('2026-12-10T00:00'), e: parseLocal('2026-12-11T00:00'), allDay: true },
      { title: 'Call', s: parseLocal('2026-12-11T11:00'), e: parseLocal('2026-12-11T12:30') },
    ]
    const request: RebalanceRequest = {
      calendar: 'c0',
      from: '2026-12-07',
      target: { mode: 'pace', perDay: 2 },
      overBudget: false,
      hours: { from: '11:00', to: '14:00' },
    }
    const result = await rebalance(plan, request, BEFORE_IT, busy)
    expect(result.report.unplaced).toBe(0)
    expectValid(plan, request, result, BEFORE_IT, busy)
    expect(result.report.reasons).toContainEqual({ kind: 'days-off', days: ['2026-12-10'] })
  })

  test('at half a session a day the sessions are two study days apart', async () => {
    const plan = planOf(course(10, () => 0.5))
    const request: RebalanceRequest = {
      calendar: 'c0',
      from: '2026-12-07',
      target: { mode: 'pace', perDay: 1 / 2 },
      overBudget: false,
      hours: { from: '11:00', to: '14:00' },
    }
    const result = await rebalance(plan, request)
    const room = roomOf(plan, request, movingSessions(plan, request), BEFORE_IT, [])
    const index = new Map(room.days.map((d) => [d.day, d.index]))
    const days = movingSessions(withMoves(plan, result.moves), request).map((e) => index.get(e.start.slice(0, 10)) ?? 0)
    expect(days.slice(1).map((d, i) => d - (days[i] ?? 0))).toEqual(Array.from({ length: 9 }, () => 2))
  })

  test('a session at 21:00 whose day stays keeps 21:00, and reviews never move', async () => {
    const sessions = course(8, () => 0.5)
    const late = event('c0', 'c0-late', parseLocal('2026-12-17T21:00'), HOUR)
    const review = event('c0', 'c0-review', parseLocal('2026-12-08T13:00'), HOUR / 2, { kind: 'review' })
    const plan = planOf([...sessions.filter((e) => !e.start.startsWith('2026-12-17')), late, review])
    const request: RebalanceRequest = {
      calendar: 'c0',
      from: '2026-12-07',
      target: { mode: 'pace', perDay: 1 },
      overBudget: false,
      hours: { from: '11:00', to: '14:00' },
    }
    const { moves } = await rebalance(plan, request)
    expect(moves.map((m) => m.uid)).not.toContain('c0-late')
    expect(moves.map((m) => m.uid)).not.toContain('c0-review')
  })

  test('a calendar with nothing left to move returns no moves and says so', async () => {
    const plan = planOf(course(5, () => 0.5).map((e) => ({ ...e, done: true })))
    const request: RebalanceRequest = {
      calendar: 'c0',
      from: '2026-12-07',
      target: { mode: 'pace', perDay: 1 },
      overBudget: false,
      hours: { from: '11:00', to: '14:00' },
    }
    const result = await rebalance(plan, request)
    expect(result.moves).toEqual([])
    expect(result.report.reasons).toEqual([{ kind: 'nothing-to-move' }])
  })

  test('a session missed earlier today goes to a slot that is still ahead', async () => {
    const plan = planOf(course(6, () => 0))
    const now = parseLocal('2026-12-07T12:10')
    const request: RebalanceRequest = {
      calendar: 'c0',
      from: '2026-12-07',
      target: { mode: 'pace', perDay: 1 },
      overBudget: false,
      hours: { from: '11:00', to: '14:00' },
    }
    const result = await rebalance(plan, request, now)
    const missed = result.moves.find((m) => m.uid === 'c0-000')
    expect(missed && parseLocal(missed.start)).toBeGreaterThanOrEqual(now)
    expectValid(plan, request, result, now, [])
  })

  test('refuses more than 300 sessions', async () => {
    const plan = planOf(course(301, () => 0.5))
    const request: RebalanceRequest = {
      calendar: 'c0',
      from: '2026-12-07',
      target: { mode: 'pace', perDay: 3 },
      overBudget: false,
      hours: { from: '11:00', to: '14:00' },
    }
    await expect(rebalance(plan, request)).rejects.toThrow('at most 300 sessions')
  })
})

/**
 * The best a deadline can get on a small case, by trying every placement: each session on one of the first study
 * days in order, within each day's room, one lab a day, and each week's room. The heaviest week of the best one.
 */
function bruteForce(plan: Plan, request: RebalanceRequest): number | null {
  const sessions = movingSessions(plan, request)
  const room = roomOf(plan, request, sessions, BEFORE_IT, [])
  const days = room.days.filter((d) => room.deadline !== null && d.day < room.deadline)
  const hours = sessions.map((e) => (parseLocal(e.end) - parseLocal(e.start)) / HOUR)
  let best: number | null = null
  const pick = (i: number, first: number, chosen: number[]) => {
    if (i === sessions.length) {
      const load = new Map<number, number>()
      const labs = new Map<number, number>()
      for (const [k, d] of chosen.entries()) {
        load.set(d, (load.get(d) ?? 0) + (hours[k] ?? 0))
        if (sessions[k]?.kind === 'lab') labs.set(d, (labs.get(d) ?? 0) + 1)
      }
      for (const [d, h] of load) {
        const day = days[d]
        if (!day || h > day.cap + 1e-9 || (labs.get(d) ?? 0) > (day.lab ? 1 : 0)) return
      }
      let peak = 0
      for (const [week, { left, fixed }] of room.weeks) {
        const placed = [...load].filter(([d]) => days[d]?.week === week).reduce((sum, [, h]) => sum + h, 0)
        if (placed > left + 1e-9) return
        peak = Math.max(peak, fixed + placed)
      }
      if (best === null || peak < best) best = peak
      return
    }
    for (let d = first; d < days.length; d++) pick(i + 1, d, [...chosen, d])
  }
  pick(0, 0, [])
  return best
}

describe('towards a deadline, against every possible placement', () => {
  test.each([11, 12, 13, 14, 15])('seed %i finishes in time whenever that is possible, as gently', async (seed) => {
    const next = random(seed)
    const sessions = course(3 + Math.floor(next() * 4), next)
    const fixed = Array.from({ length: 8 }, (_, k) =>
      event('c1', `c1-${k}`, MONDAY + Math.floor(next() * 10) * DAY + (11 + Math.floor(next() * 3)) * HOUR, HOUR),
    )
    const plan = planOf([...sessions, ...fixed])
    // Eight study days before the deadline: two weeks of weekdays less two days.
    const request: RebalanceRequest = {
      calendar: 'c0',
      from: '2026-12-07',
      deadline: '2026-12-17',
      target: { mode: 'deadline' },
      overBudget: false,
      hours: { from: '11:00', to: '14:00' },
    }
    const best = bruteForce(plan, request)
    const { report } = await rebalance(plan, request)
    if (best === null) return
    expect(report.late).toBe(0)
    expect(report.unplaced).toBe(0)
    expect(report.peakWeek).toBeCloseTo(best, 6)
  })
})

describe('on the generated schedule of this repository', () => {
  test('HF LLM from 4 January finishes before 16 February within the weekly budget', async () => {
    const plan = buildPlan(DEFAULT_CONFIG, '2026-11-22')
    const request: RebalanceRequest = {
      calendar: 'hfllm',
      from: '2027-01-04',
      deadline: '2027-02-16',
      target: { mode: 'deadline' },
      overBudget: false,
      hours: { from: '11:00', to: '14:00' },
    }
    const result = await rebalance(plan, request, parseLocal('2027-01-04T08:00'))
    expect(result.report).toMatchObject({ late: 0, unplaced: 0 })
    expect(result.report.finish && result.report.finish <= '2027-02-15').toBe(true)
    expectValid(plan, request, result, parseLocal('2027-01-04T08:00'), [])
  }, 30_000)
})
