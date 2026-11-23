import { DAY, HOUR, mondayOf, parseLocal } from './dates'
import { isSession } from './progress'
import type { Plan } from './types'

export interface WeekStats {
  /** Monday of the week, wall-clock ms */
  monday: number
  /** Planned session hours and how many of them are marked done */
  planned: number
  done: number
  /** Planned hours by calendar id */
  byCalendar: Record<string, number>
}

export interface PlanStats {
  /** Every week from the first session to the last, without gaps */
  weeks: WeekStats[]
  planned: number
  done: number
  sessions: number
  doneSessions: number
  /** Hours of the sessions that should be over by now */
  plannedByNow: number
  /** The day the remaining hours run out at the pace so far, wall-clock ms; null before anything is done */
  forecast: number | null
}

/** Numbers behind the progress dashboard. `now` is wall-clock ms. */
export function planStats(plan: Plan, now: number): PlanStats {
  const sessions = plan.events.filter(isSession)
  const stats: PlanStats = {
    weeks: [],
    planned: 0,
    done: 0,
    sessions: sessions.length,
    doneSessions: 0,
    plannedByNow: 0,
    forecast: null,
  }
  if (!sessions.length) return stats

  const starts = sessions.map((e) => parseLocal(e.start))
  const first = mondayOf(Math.min(...starts))
  const last = mondayOf(Math.max(...starts))
  for (let monday = first; monday <= last; monday += 7 * DAY) {
    stats.weeks.push({ monday, planned: 0, done: 0, byCalendar: {} })
  }
  for (const event of sessions) {
    const start = parseLocal(event.start)
    const end = parseLocal(event.end)
    const hours = (end - start) / HOUR
    const week = stats.weeks[Math.round((mondayOf(start) - first) / (7 * DAY))]
    if (!week) continue
    week.planned += hours
    week.byCalendar[event.calendar] = (week.byCalendar[event.calendar] ?? 0) + hours
    stats.planned += hours
    if (end <= now) stats.plannedByNow += hours
    if (event.done) {
      week.done += hours
      stats.done += hours
      stats.doneSessions += 1
    }
  }
  const elapsed = now - first
  if (stats.done > 0 && elapsed > 0) {
    stats.forecast = now + ((stats.planned - stats.done) / stats.done) * elapsed
  }
  return stats
}
