import type { BusyBlock } from '../busy'
import { DAY, mondayOf, parseLocal, startOfDay, weekday, ymd } from '../dates'
import { deadlineOf } from '../deadlines'
import { occurrences } from '../occurrences'
import type { Plan, PlanEvent } from '../types'
import { weeklyHours } from '../weekly-hours'
import type { RebalanceRequest } from './types'

const MINUTE = 60_000
export const HALF_HOUR = 30 * MINUTE
/** How far a re-balance looks ahead, in days from its first day; the model keeps only the part it needs */
export const MAX_DAYS = 366
const NO_CALENDARS: ReadonlySet<string> = new Set()

/** One study day: where the calendar's sessions may go */
export interface RoomDay {
  day: string
  /** Monday of the day's week */
  week: string
  /** 1 for the first study day, counting study days only */
  index: number
  /** Free 30-minute starts inside the study hours, wall-clock ms */
  slots: number[]
  /** Hours of sessions that fit: half an hour for each free slot */
  cap: number
  /** A lab fits: two free hours follow each other */
  lab: boolean
}

export interface Room {
  days: RoomDay[]
  /** Monday → hours everything else takes that week, and what is left of the budget */
  weeks: Map<string, { left: number; fixed: number }>
  deadline: string | null
  /** Study days taken whole by an all-day block of the busy calendar */
  daysOff: string[]
  /**
   * Each moving session's current slot. `outside`: it lies outside the study hours and is still ahead, so it is room
   * for that session alone.
   */
  own: Map<string, { day: string; start: number; end: number; outside: boolean }>
}

const minutesOf = (hhmm: string) => (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))) * MINUTE

/**
 * Whether a weekday is a study day for these sessions: every weekday, and Saturday or Sunday only when they already
 * use it; a course kept to weekends keeps to the weekend days it uses.
 */
export function studyWeekdays(sessions: PlanEvent[]): (day: number) => boolean {
  const used = new Set(sessions.map((e) => weekday(parseLocal(e.start))))
  const weekdays = !used.size || [...used].some((d) => d % 6 !== 0)
  return (d) => (d % 6 === 0 ? used.has(d) : weekdays)
}

/** True when `count` slots of the list follow each other without a gap. */
function hasRun(slots: number[], count: number): boolean {
  let run = 0
  for (const [i, slot] of slots.entries()) {
    run = i > 0 && slot - (slots[i - 1] ?? 0) === HALF_HOUR ? run + 1 : 1
    if (run >= count) return true
  }
  return false
}

/**
 * Step 1 of a re-balance: the study days of the year from the first day and the free time on each, the room left in
 * each week's budget, and the current slot of each moving session. A course that starts after the first day is
 * looked at from its first open session: a re-balance changes its rhythm and its end, never its start. A year, whatever the rhythm: a course kept to a few
 * weekend days, or squeezed by a full budget, needs far more calendar days than it has sessions.
 *
 * A study day is a weekday, or a weekend day of the kind the moving sessions already use; a calendar studied only at
 * weekends keeps to them. Holidays and days the busy calendar takes whole are not study days. Every busy occurrence
 * of every other event blocks time (repeats such as the gym included), and so does busy time of the busy calendar
 * and time that has passed. The moving sessions' own slots are free.
 */
export function roomOf(
  plan: Plan,
  request: RebalanceRequest,
  sessions: PlanEvent[],
  now: number,
  busy: BusyBlock[],
): Room {
  const deadline = request.deadline ?? deadlineOf(plan, request.calendar)
  const moving = new Set(sessions.map((e) => e.uid))
  const first = sessions[0]?.start.slice(0, 10) ?? request.from
  const from = parseLocal(`${first > request.from ? first : request.from}T00:00`)
  const end = from + MAX_DAYS * DAY
  const open = minutesOf(request.hours.from)
  const close = minutesOf(request.hours.to)

  const isStudyWeekday = studyWeekdays(sessions)
  const holidays = new Set(plan.meta.holidays)
  const away = new Set<string>()
  for (const block of busy) {
    if (block.allDay) for (let d = startOfDay(block.s); d < block.e; d += DAY) away.add(ymd(d))
  }
  const blocking = [
    ...occurrences(plan, from, end, NO_CALENDARS).filter(
      (o) => !moving.has(o.uid) && !o.allDay && o.availability !== 'free',
    ),
    ...busy.filter((b) => !b.allDay),
  ]
  const fixedByWeek = weeklyHours({ ...plan, events: plan.events.filter((e) => !moving.has(e.uid)) })

  const days: RoomDay[] = []
  const daysOff: string[] = []
  const weeks = new Map<string, { left: number; fixed: number }>()
  for (let d = from; d < end; d += DAY) {
    const day = ymd(d)
    if (holidays.has(day) || !isStudyWeekday(weekday(d))) continue
    if (away.has(day)) {
      daysOff.push(day)
      continue
    }
    const week = ymd(mondayOf(d))
    if (!weeks.has(week)) {
      const fixed = fixedByWeek[week] ?? 0
      weeks.set(week, { left: Math.max(0, plan.meta.weeklyBudgetHours - fixed), fixed })
    }
    const today = blocking.filter((b) => b.s < d + close && d + open < b.e)
    const slots: number[] = []
    for (let s = d + open; s + HALF_HOUR <= d + close; s += HALF_HOUR) {
      if (s >= now && !today.some((b) => b.s < s + HALF_HOUR && s < b.e)) slots.push(s)
    }
    days.push({ day, week, index: days.length + 1, slots, cap: slots.length / 2, lab: hasRun(slots, 4) })
  }

  const own = new Map(
    sessions.map((e) => {
      const start = parseLocal(e.start)
      const stop = parseLocal(e.end)
      const day = startOfDay(start)
      const outside = start >= now && (start < day + open || stop > day + close)
      return [e.uid, { day: ymd(start), start, end: stop, outside }] as const
    }),
  )
  return { days, weeks, deadline, daysOff, own }
}
