import { MIN_LOGGED, accuracyOf, paceSessions } from '../core/accuracy'
import { DAY, mondayOf, parseLocal, startOfDay } from '../core/dates'
import { courseProgress, isSession, plannedHours } from '../core/progress'
import type { Plan, PlanEvent } from '../core/types'

export interface PaceForecast {
  /** Real hours per planned hour of the logged sessions; 1 until enough are logged to say (`MIN_LOGGED`) */
  pace: number
  /** Done sessions with a logged time, as the pace counts them: the forecast is only as good as this number */
  logged: number
  /** Hours of the sessions that are not done, as planned and as they will take at each course's pace */
  remaining: number
  needed: number
  /** Hours of sessions that are over and not done: their time slots are gone */
  missed: number
  /** Day of the last planned session, wall-clock ms; null when nothing is left */
  planned: number | null
  /** Day the work runs out at this pace, wall-clock ms; null when nothing is left */
  finish: number | null
}

/**
 * The day a number of hours of work runs out. It is poured into the time the plan still holds, the slots of the open
 * sessions ahead; what does not fit goes on after the last one (`lastDay`), week by week, in the part of the weekly
 * budget that the courses outside `courses` leave free.
 */
function pourer(plan: Plan, open: readonly PlanEvent[], courses: ReadonlySet<string>, now: number, lastDay: number) {
  const ahead = open
    .filter((e) => parseLocal(e.end) > now)
    .map((e) => ({ day: startOfDay(parseLocal(e.start)), hours: plannedHours(e) }))
  const others = new Map<number, number>()
  for (const event of plan.events) {
    if (!isSession(event) || event.done || courses.has(event.calendar)) continue
    const monday = mondayOf(parseLocal(event.start))
    others.set(monday, (others.get(monday) ?? 0) + plannedHours(event))
  }
  const lastOther = Math.max(0, ...others.keys())
  const budget = Math.max(plan.meta.weeklyBudgetHours, 1)
  const after = mondayOf(Math.max(lastDay, startOfDay(now))) + 7 * DAY
  return (needed: number): number => {
    let left = needed
    for (const slot of ahead) {
      left -= slot.hours
      if (left <= 1e-9) return slot.day
    }
    for (let monday = after; ; monday += 7 * DAY) {
      // Weeks the other courses fill completely give nothing; once they are over the whole budget is free.
      const free = monday > lastOther ? budget : Math.max(0, budget - (others.get(monday) ?? 0))
      if (free >= left) return monday + Math.min(6, Math.ceil((left / free) * 7) - 1) * DAY
      left -= free
    }
  }
}

/**
 * When the work that is left will really be finished. Each open session is taken to need its planned length
 * times the pace of its course so far. That work is poured into the time the plan still holds, the slots of the
 * sessions ahead; what does not fit goes on after the last one, week by week, in the part of the weekly budget
 * that the other courses leave free.
 *
 * `calendar` limits the forecast to one course; `now` is wall-clock ms.
 */
export function paceForecast(plan: Plan, now: number, calendar?: string): PaceForecast {
  const courses = courseProgress(plan).filter((c) => !calendar || c.calendar.id === calendar)
  const paceOf = new Map(courses.map((c) => [c.calendar.id, c.pace]))
  const sessions = plan.events
    .filter((e) => isSession(e) && paceOf.has(e.calendar))
    .toSorted((a, b) => a.start.localeCompare(b.start))
  const open = sessions.filter((e) => !e.done)
  const accuracy = accuracyOf(sessions, plan.events)
  const forecast: PaceForecast = {
    pace: accuracy.pace ?? 1,
    logged: accuracy.logged,
    remaining: 0,
    needed: 0,
    missed: 0,
    planned: null,
    finish: null,
  }
  const last = open.at(-1)
  if (!last) return forecast

  for (const event of open) {
    const hours = plannedHours(event)
    forecast.remaining += hours
    forecast.needed += hours * (event.paced ? 1 : (paceOf.get(event.calendar) ?? 1))
    if (parseLocal(event.end) <= now) forecast.missed += hours
  }
  forecast.planned = startOfDay(parseLocal(last.start))
  forecast.finish = pourer(plan, open, new Set(paceOf.keys()), now, forecast.planned)(forecast.needed)
  return forecast
}

/** Simulated futures behind a finish range: enough that its 90th percentile settles to within a day. */
const RUNS = 1000
/** Logged times older than this drop out of the draw: Evidence-Based Scheduling throws away velocities older than about six months */
const HORIZON = 183 * DAY

/** When the work that is left will be finished, as a range over futures drawn from the logged times. */
export interface FinishRange {
  /** Days by which half and nine in ten of the simulated futures are finished, wall-clock ms */
  likely: number
  late: number
  /** `course`: each course drew from its own logged sessions; `all`: one at least had too few and drew from every course's */
  scope: 'course' | 'all'
}

export interface RangeOptions {
  /** Limits the range to one course */
  calendar?: string | undefined
  /** The same seed gives the same range */
  seed?: number | undefined
  runs?: number | undefined
}

/** A small seeded generator (mulberry32), uniform in [0, 1). */
function random(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/**
 * Logged ratios to draw from. Each is as likely as the planned hours it covers, so a planned hour drawn at random
 * takes the course's pace on average, and the middle of the range stays with the pace forecast.
 */
interface Pool {
  ratios: number[]
  /** Running total of the planned hours, for a weighted draw */
  upTo: number[]
  /** Real ÷ planned hours of the pool */
  pace: number
}

function poolOf(logged: readonly PlanEvent[]): Pool | null {
  if (logged.length < MIN_LOGGED) return null
  const ratios: number[] = []
  const upTo: number[] = []
  let planned = 0
  let spent = 0
  for (const event of logged) {
    const hours = plannedHours(event)
    const real = (event.actual ?? 0) / 60
    ratios.push(real / hours)
    planned += hours
    spent += real
    upTo.push(planned)
  }
  return { ratios, upTo, pace: spent / planned }
}

function draw(pool: Pool, u: number): number {
  const target = u * (pool.upTo.at(-1) ?? 0)
  let lo = 0
  let hi = pool.upTo.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if ((pool.upTo[mid] ?? 0) > target) hi = mid
    else lo = mid + 1
  }
  return pool.ratios[lo] ?? 1
}

/**
 * Evidence-Based Scheduling's Monte Carlo: in each simulated future every open session takes its planned length
 * times a ratio drawn from the logged sessions of its course, or of every course while its own are fewer than
 * `MIN_LOGGED`; a session spread over sittings is one of them, as `paceSessions` counts it. A session already resized
 * to the pace takes the drawn ratio over the pool's pace, so only the spread is added to it. Each future is poured
 * into the calendar as `paceForecast` does. Null while some open session has nothing to draw from
 * (docs/estimate-accuracy-research.md, 5.1).
 *
 * Each future first resamples the logged sessions and draws from that resample. Drawn straight from the log, the
 * ratios of thirty sessions average out and the range shrinks to a day or two, as if six logged sessions had settled
 * the typical ratio; the resample keeps that doubt, and it narrows as more sessions are logged.
 */
export function finishRange(
  plan: Plan,
  now: number,
  { calendar, seed = 1, runs = RUNS }: RangeOptions = {},
): FinishRange | null {
  const courses = new Set(
    courseProgress(plan)
      .map((c) => c.calendar.id)
      .filter((id) => !calendar || id === calendar),
  )
  const open = plan.events
    .filter((e) => isSession(e) && !e.done && courses.has(e.calendar))
    .toSorted((a, b) => a.start.localeCompare(b.start))
  const last = open.at(-1)
  if (!last) return null
  const recent = paceSessions(plan.events.filter(isSession), plan.events).filter(
    (e) => e.done && e.actual !== undefined && plannedHours(e) > 0 && parseLocal(e.began ?? e.start) > now - HORIZON,
  )
  const every = poolOf(recent)
  const pools = new Map<string, Pool>()
  let scope: FinishRange['scope'] = 'course'
  for (const id of new Set(open.map((e) => e.calendar))) {
    const own = poolOf(recent.filter((e) => e.calendar === id))
    const pool = own ?? every
    if (!pool) return null
    if (!own) scope = 'all'
    pools.set(id, pool)
  }

  const finish = pourer(plan, open, courses, now, startOfDay(parseLocal(last.start)))
  const next = random(seed)
  const distinct = [...new Set(pools.values())]
  const days: number[] = []
  for (let run = 0; run < runs; run++) {
    const resampled = new Map(distinct.map((pool) => [pool, pool.ratios.map(() => draw(pool, next()))]))
    let needed = 0
    for (const event of open) {
      const pool = pools.get(event.calendar)
      const sample = pool && resampled.get(pool)
      const ratio = sample ? (sample[Math.floor(next() * sample.length)] ?? 1) : 1
      needed += plannedHours(event) * (event.paced && pool ? ratio / pool.pace : ratio)
    }
    days.push(finish(needed))
  }
  const sorted = days.toSorted((a, b) => a - b)
  const at = (share: number) => sorted[Math.max(0, Math.ceil(share * sorted.length) - 1)] ?? 0
  return { likely: at(0.5), late: at(0.9), scope }
}
