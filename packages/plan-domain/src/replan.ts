import { DAY, HOUR, mondayOf, parseLocal, startOfDay, toLocalString, weekday, ymd } from './dates'
import { nextDeadline } from './deadlines'
import { courseProgress, isSession, plannedHours } from './progress'
import type { Plan, PlanEvent } from './types'

/** One session in a new slot. Times are Europe/Minsk wall-clock strings. */
export interface SessionMove {
  uid: string
  start: string
  end: string
}

export interface CatchUpScenario {
  /**
   * `push`: every open session slides to a later study day, the weekly load stays and the plan ends later.
   * `squeeze`: only the missed sessions move, into the Saturday buffers and an extra hour after the sessions of
   * the coming days; the plan ends when it did and the weeks get heavier.
   * `pace`: every session ahead gets the length it really takes at the pace of its course so far; the days stay.
   */
  id: 'push' | 'squeeze' | 'pace'
  moves: SessionMove[]
  /** The moves set real lengths: the sessions are marked so that the pace is not applied to them twice */
  paced?: boolean
  /** uids of the missed sessions the scenario found no room for, in date order */
  unplaced: string[]
}

/** What a plan promises from `now` on: the numbers the scenarios are compared by. */
export interface PlanOutlook {
  /** Open sessions that are already over */
  missed: number
  /** Day of the last open session, wall-clock ms; null when nothing is left */
  finish: number | null
  /** Days between the last open session of the nearest deadline's calendar and that deadline; negative when past it */
  deadlineMargin: number | null
  /** Study hours of the heaviest week from this one on, and how many such weeks are over the weekly budget */
  peakWeek: number
  overWeeks: number
}

/** How far ahead `squeeze` looks for room */
const SQUEEZE_DAYS = 56

const dayOf = (e: PlanEvent) => e.start.slice(0, 10)
const openSessions = (plan: Plan) =>
  plan.events.filter((e) => isSession(e) && !e.done).toSorted((a, b) => a.start.localeCompare(b.start))
const isMissed = (e: PlanEvent, now: number) => parseLocal(e.end) <= now

export function planOutlook(plan: Plan, now: number): PlanOutlook {
  const open = openSessions(plan)
  const last = open.at(-1)
  const deadline = nextDeadline(plan, now)
  const lastBefore = deadline && open.findLast((e) => e.calendar === deadline.calendar)
  const weeks = new Map<number, number>()
  for (const e of plan.events) {
    if (!isSession(e) || e.calendar === 'personal') continue
    const monday = mondayOf(parseLocal(e.start))
    if (monday >= mondayOf(now)) weeks.set(monday, (weeks.get(monday) ?? 0) + plannedHours(e))
  }
  const loads = [...weeks.values()]
  return {
    missed: open.filter((e) => isMissed(e, now)).length,
    finish: last ? startOfDay(parseLocal(last.start)) : null,
    deadlineMargin: lastBefore
      ? Math.round((parseLocal(`${deadline.day}T00:00`) - startOfDay(parseLocal(lastBefore.start))) / DAY)
      : null,
    peakWeek: Math.max(0, ...loads),
    overWeeks: loads.filter((hours) => hours > plan.meta.weeklyBudgetHours + 1e-9).length,
  }
}

/** The plan as it would be after the moves: for a preview, nothing is stored. */
export function withMoves(plan: Plan, moves: SessionMove[]): Plan {
  const byUid = new Map(moves.map((move) => [move.uid, move]))
  return {
    ...plan,
    events: plan.events.map((e) => {
      const move = byUid.get(e.uid)
      return move ? { ...e, start: move.start, end: move.end } : e
    }),
  }
}

const moveTo = (e: PlanEvent, start: number): SessionMove => ({
  uid: e.uid,
  start: toLocalString(start),
  end: toLocalString(start + parseLocal(e.end) - parseLocal(e.start)),
})

/** Every open session slides forward by as many study days as were missed; the days keep their own sessions' hours. */
function push(plan: Plan, now: number): CatchUpScenario {
  const today = ymd(now)
  const open = openSessions(plan)
  const days = [...new Set(open.map(dayOf))]
  const behind = days.filter(
    (day) => day < today || (day === today && open.some((e) => dayOf(e) === day && isMissed(e, now))),
  )
  const targets = days.filter((day) => day > today)
  const sources = [...behind, ...targets]

  // Past the last planned day the plan goes on with the weekdays of its last week.
  const holidays = new Set(plan.meta.holidays)
  const tail = (targets.length ? targets : behind).slice(-7)
  const lastDay = parseLocal(`${tail.at(-1) ?? today}T00:00`)
  const pattern = new Set(
    tail
      .filter((day) => parseLocal(`${day}T00:00`) > lastDay - 7 * DAY)
      .map((day) => weekday(parseLocal(`${day}T00:00`))),
  )
  let cursor = Math.max(lastDay, startOfDay(now))
  while (targets.length < sources.length && pattern.size) {
    cursor += DAY
    if (pattern.has(weekday(cursor)) && !holidays.has(ymd(cursor))) targets.push(ymd(cursor))
  }

  const target = new Map(sources.map((day, i) => [day, targets[i]]))
  const moves: SessionMove[] = []
  for (const e of behind.length ? open : []) {
    const to = target.get(dayOf(e))
    if (!to || to === dayOf(e)) continue
    const start = parseLocal(e.start)
    moves.push(moveTo(e, parseLocal(`${to}T00:00`) + (start - startOfDay(start))))
  }
  return { id: 'push', moves, unplaced: [] }
}

/** The missed sessions go into the free time of the coming days: the Saturday buffers, and one more hour after a day's sessions. */
function squeeze(plan: Plan, now: number): CatchUpScenario {
  const missed = openSessions(plan).filter((e) => isMissed(e, now))
  const timed = plan.events.filter((e) => !e.rrule && !e.allDay)
  const moves: SessionMove[] = []
  let next = 0
  for (
    let day = startOfDay(now) + DAY;
    next < missed.length && day < startOfDay(now) + SQUEEZE_DAYS * DAY;
    day += DAY
  ) {
    const here = timed.filter((e) => dayOf(e) === ymd(day))
    const buffers = here.filter((e) => e.kind === 'buffer')
    const sessions = here.filter((e) => isSession(e) && !e.done)
    const windows = buffers.length
      ? buffers.map((e) => ({ from: parseLocal(e.start), to: parseLocal(e.end) }))
      : sessions.length
        ? [Math.max(...here.map((e) => parseLocal(e.end)))].map((from) => ({ from, to: from + HOUR }))
        : []
    for (const window of windows) {
      let at = window.from
      for (
        let session = missed[next];
        session && at + plannedHours(session) * HOUR <= window.to;
        session = missed[next]
      ) {
        moves.push(moveTo(session, at))
        at += plannedHours(session) * HOUR
        next += 1
      }
    }
  }
  return { id: 'squeeze', moves, unplaced: missed.slice(next).map((e) => e.uid) }
}

const QUARTER = HOUR / 4

/**
 * The sessions ahead resized to the pace of their course, a quarter of an hour at the least. A day's sessions
 * keep their order and start one after another, so a longer one pushes the next instead of covering it.
 */
function atPace(plan: Plan, now: number): CatchUpScenario {
  const paceOf = new Map(courseProgress(plan).map((c) => [c.calendar.id, c.pace]))
  const moves: SessionMove[] = []
  const busyUntil = new Map<string, number>()
  for (const e of openSessions(plan)) {
    const start = parseLocal(e.start)
    if (start <= now || e.paced) continue
    const length = parseLocal(e.end) - start
    const real = Math.max(QUARTER, Math.round((length * (paceOf.get(e.calendar) ?? 1)) / QUARTER) * QUARTER)
    const from = Math.max(start, busyUntil.get(dayOf(e)) ?? 0)
    // A session that would run past midnight keeps its length: the day has no room for more.
    const to = startOfDay(from + real - 1) === startOfDay(from) ? from + real : from + length
    busyUntil.set(dayOf(e), to)
    if (from !== start || to !== start + length) {
      moves.push({ uid: e.uid, start: toLocalString(from), end: toLocalString(to) })
    }
  }
  return { id: 'pace', moves, paced: true, unplaced: [] }
}

/**
 * Ways to bring the plan back in line with reality, each as the list of moves that does it: two for sessions
 * that were missed, one for a pace that differs from the plan. Empty when neither is the case.
 */
export function catchUpScenarios(plan: Plan, now: number): CatchUpScenario[] {
  const behind = openSessions(plan).some((e) => isMissed(e, now))
  return [...(behind ? [push(plan, now), squeeze(plan, now)] : []), atPace(plan, now)].filter(
    (scenario) => scenario.moves.length > 0,
  )
}
