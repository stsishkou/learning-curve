import { DAY, parseLocal, startOfDay, weekday, ymd } from '../dates'
import { deadlineOf } from '../deadlines'
import { isRecord } from '../edits'
import { isSession } from '../progress'
import type { Plan, PlanEvent } from '../types'
import { studyWeekdays } from './room'
import { RHYTHMS, type RebalanceRequest, type RebalanceTarget } from './types'

const DAY_TEXT = /^\d{4}-\d{2}-\d{2}$/
const HOUR_TEXT = /^(?:[01]\d|2[0-3]):[03]0$|^24:00$/
const SHARE = 0.9
const FALLBACK_HOURS = { from: '10:00', to: '18:00' }

const isDay = (text: string) => DAY_TEXT.test(text) && ymd(parseLocal(`${text}T00:00`)) === text
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const clock = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`

/**
 * The smallest window of the day that holds the start and the end of at least nine in ten open weekday sessions:
 * the hours the person keeps for study, not stretched by the odd session put in the evening by hand. Its edges are
 * on the half-hour grid.
 */
export function defaultStudyHours(plan: Plan): { from: string; to: string } {
  const spans = plan.events
    .filter((e) => isSession(e) && !e.done && weekday(parseLocal(e.start)) % 6 !== 0)
    .map((e) => ({ s: minutes(e.start.slice(11)), e: minutes(e.end.slice(11)) || 24 * 60 }))
  if (!spans.length) return FALLBACK_HOURS
  const needed = Math.ceil(SHARE * spans.length)
  let best: { s: number; e: number } | null = null
  for (const s of new Set(spans.map((x) => x.s))) {
    for (const e of new Set(spans.map((x) => x.e))) {
      if (e <= s || (best && (e - s > best.e - best.s || (e - s === best.e - best.s && s >= best.s)))) continue
      if (spans.filter((x) => x.s >= s && x.e <= e).length >= needed) best = { s, e }
    }
  }
  if (!best) return FALLBACK_HOURS
  return { from: clock(Math.floor(best.s / 30) * 30), to: clock(Math.min(24 * 60, Math.ceil(best.e / 30) * 30)) }
}

const sameNumber = (a: number, b: number) => Math.abs(a - b) < 1e-9

function target(value: unknown): RebalanceTarget {
  if (isRecord(value) && value.mode === 'deadline') return { mode: 'deadline' }
  if (isRecord(value) && value.mode === 'rhythm' && typeof value.perDay === 'number') {
    const { perDay } = value
    const rhythm = RHYTHMS.find((p) => sameNumber(p, perDay))
    if (rhythm !== undefined) return { mode: 'rhythm', perDay: rhythm }
  }
  throw new Error('The rhythm must be one of 1/3, 1/2, 1, 3/2, 2, 3 sessions a day')
}

/** A re-balance request as it comes from the dialog or a tool, checked against the plan it is for. */
export function parseRebalanceRequest(value: unknown, plan: Plan): RebalanceRequest {
  if (!isRecord(value)) throw new Error('The request must be an object')
  const { calendar, from, deadline, hours, overBudget } = value
  if (typeof calendar !== 'string' || !plan.calendars.some((c) => c.id === calendar)) {
    throw new Error(`Unknown calendar "${String(calendar)}"`)
  }
  if (typeof from !== 'string' || !isDay(from)) throw new Error('from must look like 2026-11-23')
  if (deadline !== undefined && (typeof deadline !== 'string' || !isDay(deadline))) {
    throw new Error('deadline must look like 2026-11-23')
  }
  const aim = target(value.target)
  const due = deadline ?? (aim.mode === 'deadline' ? deadlineOf(plan, calendar) : null)
  if (aim.mode === 'deadline' && due === null) {
    throw new Error('The deadline mode needs a deadline: type one, or add a milestone to the calendar')
  }
  if (due !== null && due <= from) throw new Error('The deadline must come after the first day')
  let window = defaultStudyHours(plan)
  if (hours !== undefined) {
    if (!isRecord(hours) || typeof hours.from !== 'string' || typeof hours.to !== 'string') {
      throw new Error('Study hours must look like 11:00 or 11:30')
    }
    if (!HOUR_TEXT.test(hours.from) || !HOUR_TEXT.test(hours.to)) {
      throw new Error('Study hours must look like 11:00 or 11:30')
    }
    if (minutes(hours.from) >= minutes(hours.to)) throw new Error('The study hours must end after they start')
    window = { from: hours.from, to: hours.to }
  }
  return { calendar, from, deadline, target: aim, overBudget: overBudget === true, hours: window }
}

/**
 * The sessions a re-balance moves: the calendar's open sessions from the first day on, in their order. Reviews stay:
 * their spacing after a finished module must not follow the course.
 */
export const movingSessions = (plan: Plan, request: Pick<RebalanceRequest, 'calendar' | 'from'>): PlanEvent[] =>
  plan.events
    .filter(
      (e) =>
        e.calendar === request.calendar &&
        isSession(e) &&
        !e.done &&
        e.kind !== 'review' &&
        e.start.slice(0, 10) >= request.from,
    )
    .toSorted((a, b) => a.start.localeCompare(b.start))

/**
 * How many of the calendar's open sessions it has per study day now, from its first open session on `from` or later
 * to its last, counting study days as a re-balance does; null for fewer than two sessions.
 */
export function currentRhythm(plan: Plan, calendar: string, from: string): number | null {
  const sessions = movingSessions(plan, { calendar, from })
  const [first] = sessions
  const last = sessions.at(-1)
  if (!first || !last || sessions.length < 2) return null
  const isStudyWeekday = studyWeekdays(sessions)
  const holidays = new Set(plan.meta.holidays)
  let days = 0
  for (let d = startOfDay(parseLocal(first.start)); d <= parseLocal(last.start); d += DAY) {
    if (!holidays.has(ymd(d)) && isStudyWeekday(weekday(d))) days++
  }
  return days ? sessions.length / days : null
}

/** The rhythm the dialog offers that is nearest to `perDay`, by ratio: twice as fast is as far as half as fast. */
export const nearestRhythm = (perDay: number): (typeof RHYTHMS)[number] =>
  RHYTHMS.reduce<(typeof RHYTHMS)[number]>(
    (best, rhythm) => (Math.abs(Math.log(rhythm / perDay)) < Math.abs(Math.log(best / perDay)) ? rhythm : best),
    1,
  )
