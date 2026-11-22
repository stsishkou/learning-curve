import { DAY, parseLocal, startOfDay, toLocalString, weekday } from './dates'
import type { EventPatch } from './edits'
import type { PlanEvent } from './types'

const CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]

/** A weekly rule the viewer can read and rewrite: it must name its weekdays. */
export const WEEKLY_RULE = /^FREQ=WEEKLY(?:;[A-Z]+=[A-Z0-9,]+)*$/

/** Weekdays of a weekly RRULE, 0 = Sunday. */
export const weekdaysOf = (rrule: string): number[] =>
  (rrule.match(/BYDAY=([A-Z,]+)/)?.[1] ?? '')
    .split(',')
    .map((code) => CODES.indexOf(code))
    .filter((day) => day !== -1)

/**
 * The patch that moves a repeating event as a whole series: the repeat that was at `from` now runs `s`–`e`
 * (wall-clock ms). The time of day and the length change for every repeat; a move to another day replaces
 * that weekday in the rule.
 */
export function moveSeries(event: PlanEvent, from: number, s: number, e: number): EventPatch {
  const days = new Set(weekdaysOf(event.rrule ?? ''))
  days.delete(weekday(from))
  days.add(weekday(s))
  // Calendars count the first date as a repeat even when the rule does not name its weekday.
  let first = startOfDay(parseLocal(event.start))
  while (!days.has(weekday(first))) first += DAY
  const time = s - startOfDay(s)
  const byDay = `BYDAY=${MONDAY_FIRST.filter((d) => days.has(d))
    .map((d) => CODES[d])
    .join(',')}`
  return {
    start: toLocalString(first + time),
    end: toLocalString(first + time + (e - s)),
    rrule: (event.rrule ?? 'FREQ=WEEKLY;BYDAY=MO').replace(/BYDAY=[A-Z,]+/, byDay),
  }
}

/**
 * The patch for an event dragged in a calendar: the occurrence that started at `from` now runs `s`–`e`
 * (wall-clock ms). A repeating event moves as a series, an all-day one keeps its length and changes the day.
 */
export function movePatch(event: PlanEvent, from: number, s: number, e: number): EventPatch {
  if (event.rrule) return moveSeries(event, from, s, e)
  if (!event.allDay) return { start: toLocalString(s), end: toLocalString(e) }
  const shift = startOfDay(s) - startOfDay(from)
  return {
    start: toLocalString(parseLocal(event.start) + shift),
    end: toLocalString(parseLocal(event.end) + shift),
  }
}
