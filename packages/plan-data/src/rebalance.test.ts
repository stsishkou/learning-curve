import {
  DAY,
  DEFAULT_CONFIG,
  HOUR,
  PACES,
  buildPlan,
  defaultStudyHours,
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

import { requestFromTool } from './rebalance'
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
 * The best a deadline can get on a small case, by trying every placement: each session on one of the study days
 * before it in order, within each day's room, one lab a day, and each week's room. The fewest sessions the busiest
 * day of such a placement must hold, or null when none finishes in time.
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
      for (const [week, { left }] of room.weeks) {
        const placed = [...load].filter(([d]) => days[d]?.week === week).reduce((sum, [, h]) => sum + h, 0)
        if (placed > left + 1e-9) return
      }
      const count = new Map<number, number>()
      for (const d of chosen) count.set(d, (count.get(d) ?? 0) + 1)
      const busiest = Math.max(...count.values())
      if (best === null || busiest < best) best = busiest
      return
    }
    for (let d = first; d < days.length; d++) pick(i + 1, d, [...chosen, d])
  }
  pick(0, 0, [])
  return best
}

describe('towards a deadline, against every possible placement', () => {
  test.each([11, 12, 13, 14, 15])(
    'seed %i finishes in time whenever that is possible, no day busier than it must',
    async (seed) => {
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
      const result = await rebalance(plan, request)
      if (best === null) return
      expect(result.report.late).toBe(0)
      expect(result.report.unplaced).toBe(0)
      expect(crowd(plan, request, result)).toBe(best)
    },
  )
})

/** The day of each moving session once the moves are applied, in order. */
const daysAfter = (plan: Plan, request: RebalanceRequest, result: RebalanceResult) =>
  movingSessions(withMoves(plan, result.moves), request).map((e) => e.start.slice(0, 10))

/** The most sessions of the course on one day once the moves are applied. */
const crowd = (plan: Plan, request: RebalanceRequest, result: RebalanceResult) => {
  const count = new Map<string, number>()
  for (const day of daysAfter(plan, request, result)) count.set(day, (count.get(day) ?? 0) + 1)
  return Math.max(0, ...count.values())
}

const paceRequest = (calendar: string, from: string, perDay: number): RebalanceRequest => ({
  calendar,
  from,
  target: { mode: 'pace', perDay },
  overBudget: false,
  hours: { from: '11:00', to: '14:00' },
})

describe('a re-balance never makes up for lost days with a crunch', () => {
  test('from a day already past, the missed sessions start again today, one a day', async () => {
    // One a weekday from Monday 7 December; it is now Wednesday 16 December, so seven of them were missed.
    const plan = planOf(course(15, () => 0.5))
    const now = parseLocal('2026-12-16T08:00')
    const request = paceRequest('c0', '2026-12-07', 1)
    const result = await rebalance(plan, request, now)
    expect(crowd(plan, request, result)).toBe(1)
    expect(daysAfter(plan, request, result)[0]).toBe('2026-12-16')
    expectValid(plan, request, result, now, [])
  })

  test('after a week with no budget left, the course keeps its own rhythm', async () => {
    // Another course takes the whole budget of the week of 7 December in the evenings; this one starts on the 14th.
    const sessions = course(10, () => 0.5, MONDAY + 7 * DAY)
    const evenings = Array.from({ length: 6 }, (_, k) =>
      event('c1', `c1-${k}`, parseLocal('2026-12-07T17:00') + k * DAY, 2 * HOUR),
    )
    const plan = planOf([...sessions, ...evenings])
    const request = paceRequest('c0', '2026-12-07', 1)
    const result = await rebalance(plan, request)
    expect(crowd(plan, request, result)).toBe(1)
    expect(result.moves).toEqual([])
  })

  test('a course studied on Saturdays keeps one a Saturday, or one every other Saturday', async () => {
    const saturday = parseLocal('2026-12-12T00:00')
    const sessions = Array.from({ length: 10 }, (_, i) =>
      event('c0', `c0-${String(i).padStart(3, '0')}`, saturday + i * 7 * DAY + 11 * HOUR, HOUR),
    )
    const plan = planOf(sessions)
    const now = parseLocal('2026-12-12T08:00')
    const weekly = await rebalance(plan, paceRequest('c0', '2026-12-12', 1), now)
    expect(weekly.moves).toEqual([])
    const request = paceRequest('c0', '2026-12-12', 1 / 2)
    const fortnightly = await rebalance(plan, request, now)
    const days = daysAfter(plan, request, fortnightly).map((day) => parseLocal(`${day}T00:00`))
    expect(days.slice(1).map((d, i) => (d - (days[i] ?? 0)) / DAY)).toEqual(Array.from({ length: 9 }, () => 14))
  })
})

describe('on the generated schedule of this repository', () => {
  const START = parseLocal('2027-01-04T08:00')

  // Each pace solves a real course of some 35 sessions; a level may take its two seconds.
  test.each(PACES.map((perDay) => [perDay]))(
    'HF LLM at %d a day finds room for every session and never crowds a day beyond the pace',
    async (perDay) => {
      const plan = buildPlan(DEFAULT_CONFIG, '2026-11-22')
      const request = paceRequest('hfllm', '2027-01-04', perDay)
      const result = await rebalance(plan, request, START)
      expect(result.report.unplaced).toBe(0)
      expect(crowd(plan, request, result)).toBeLessThanOrEqual(Math.ceil(perDay))
      expectValid(plan, request, result, START, [])
    },
    30_000,
  )

  test('HF LLM at one every three days moves the course and ends later than at one a day', async () => {
    const plan = buildPlan(DEFAULT_CONFIG, '2026-11-22')
    const slow = await rebalance(plan, paceRequest('hfllm', '2027-01-04', 1 / 3), START)
    const daily = await rebalance(plan, paceRequest('hfllm', '2027-01-04', 1), START)
    expect(slow.moves.length).toBeGreaterThan(0)
    expect((slow.report.finish ?? '') > (daily.report.finish ?? '')).toBe(true)
  }, 30_000)

  test.each([['2027-03-31'], ['2027-05-31']])(
    'HF LLM towards a far deadline of %s starts at once and spreads out, one session a day at most',
    async (deadline) => {
      const plan = buildPlan(DEFAULT_CONFIG, '2026-11-22')
      const request: RebalanceRequest = {
        ...paceRequest('hfllm', '2027-01-04', 1),
        deadline,
        target: { mode: 'deadline' },
      }
      const result = await rebalance(plan, request, START)
      expect(result.report).toMatchObject({ late: 0, unplaced: 0 })
      expect(daysAfter(plan, request, result)[0]).toBe('2027-01-04')
      expect(crowd(plan, request, result)).toBe(1)
      expectValid(plan, request, result, START, [])
    },
    30_000,
  )

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

describe('requestFromTool', () => {
  test('the MCP arguments map to a request', () => {
    const plan = buildPlan(DEFAULT_CONFIG, '2026-11-22')
    expect(requestFromTool({ calendar: 'hfllm', from: '2027-01-04', mode: 'pace', perDay: 0.5 }, plan)).toEqual({
      calendar: 'hfllm',
      from: '2027-01-04',
      deadline: undefined,
      target: { mode: 'pace', perDay: 0.5 },
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
