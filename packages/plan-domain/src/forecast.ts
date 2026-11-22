import { DAY, parseLocal, startOfDay } from './dates'
import { courseProgress, isSession, plannedHours } from './progress'
import type { Plan } from './types'

export interface PaceForecast {
  /** Real hours per planned hour over the done sessions; 1 until a session is done */
  pace: number
  /** Done sessions with a logged time: the forecast is only as good as this number */
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
 * When the work that is left will really be finished. Each open session is taken to need its planned length
 * times the pace of its course so far. That work is poured into the time the plan still holds, the slots of the
 * sessions ahead; what does not fit goes on after the last one at the weekly budget.
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
  const doneHours = courses.reduce((sum, c) => sum + c.doneHours, 0)
  const forecast: PaceForecast = {
    pace: doneHours ? courses.reduce((sum, c) => sum + c.spentHours, 0) / doneHours : 1,
    logged: sessions.filter((e) => e.done && e.actual !== undefined).length,
    remaining: 0,
    needed: 0,
    missed: 0,
    planned: null,
    finish: null,
  }
  if (!open.length) return forecast

  for (const event of open) {
    const hours = plannedHours(event)
    forecast.remaining += hours
    forecast.needed += hours * (paceOf.get(event.calendar) ?? 1)
    if (parseLocal(event.end) <= now) forecast.missed += hours
  }
  const lastDay = startOfDay(parseLocal(open[open.length - 1].start))
  forecast.planned = lastDay

  let left = forecast.needed
  for (const event of open) {
    if (parseLocal(event.end) <= now) continue
    left -= plannedHours(event)
    if (left <= 1e-9) {
      forecast.finish = startOfDay(parseLocal(event.start))
      return forecast
    }
  }
  const perDay = Math.max(plan.meta.weeklyBudgetHours, 1) / 7
  forecast.finish = Math.max(lastDay, startOfDay(now)) + Math.ceil(left / perDay) * DAY
  return forecast
}
