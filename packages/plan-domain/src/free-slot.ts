import type { BusyBlock } from './busy'
import { DAY, HOUR, mondayOf, startOfDay, weekday, ymd } from './dates'
import { occurrences } from './occurrences'
import { weeklyHours } from './schedule'
import type { Plan } from './types'

const STEP = HOUR / 2
const NO_CALENDARS: ReadonlySet<string> = new Set()

export interface FreeSlotOptions {
  /** Nothing earlier than this moment is offered, Minsk wall-clock ms */
  from: number
  /** Length of the slot in ms */
  length: number
  /** The hour of the day to try first on every day, e.g. the one the event has now */
  preferHour?: number
  /** The event being moved: its own time does not block it and its hours are not counted twice */
  except?: { uid: string; s: number; e: number; study: boolean }
  /** Busy time of the person's own calendar */
  busy?: BusyBlock[]
  /** The hours a slot may take, as hours of the day; 8 to 21 when left out */
  dayStart?: number
  dayEnd?: number
  /** How many days ahead to look; four weeks when left out */
  days?: number
}

/**
 * The first slot of the given length that is free: on a day that is not a holiday or a weekend, clear of every
 * busy event (repeats included) and of the person's own calendar, and in a week that stays inside the budget.
 * Each day is tried at the preferred hour first, then from morning to evening in half-hour steps.
 */
export function nextFreeSlot(plan: Plan, options: FreeSlotOptions): { s: number; e: number } | null {
  const { from, length, except, busy = [], dayStart = 8, dayEnd = 21, days = 28 } = options
  const planned = weeklyHours(plan)
  const first = Math.ceil(from / STEP) * STEP
  for (let day = startOfDay(from); day < startOfDay(from) + days * DAY; day += DAY) {
    if (weekday(day) % 6 === 0 || plan.meta.holidays.includes(ymd(day))) continue
    const week = mondayOf(day)
    const own = except?.study && mondayOf(except.s) === week ? (except.e - except.s) / HOUR : 0
    if ((planned[ymd(week)] ?? 0) - own + length / HOUR > plan.meta.weeklyBudgetHours) continue
    const taken = [
      ...occurrences(plan, day, day + DAY, NO_CALENDARS).filter(
        (o) => !o.allDay && o.availability !== 'free' && o.uid !== except?.uid,
      ),
      ...busy.filter((b) => !b.allDay),
    ]
    const starts = Array.from(
      { length: Math.max(0, ((dayEnd - dayStart) * HOUR - length) / STEP + 1) },
      (_, i) => day + dayStart * HOUR + i * STEP,
    )
    const preferred = options.preferHour === undefined ? [] : [day + options.preferHour * HOUR]
    const slot = [...preferred.filter((s) => starts.includes(s)), ...starts].find(
      (s) => s >= first && !taken.some((t) => t.s < s + length && s < t.e),
    )
    if (slot !== undefined) return { s: slot, e: slot + length }
  }
  return null
}
