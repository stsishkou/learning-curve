import { DAY, parseLocal, weekday } from './dates'
import type { Plan } from './types'

/** Busy study hours per week (Monday key), for checks against the budget. */
export function weeklyHours(plan: Plan): Record<string, number> {
  const weeks: Record<string, number> = {}
  for (const e of plan.events) {
    if (e.allDay || e.rrule || e.availability === 'free') continue
    const t = parseLocal(e.start)
    const monday = t - ((weekday(t) + 6) % 7) * DAY
    const key = new Date(monday).toISOString().slice(0, 10)
    weeks[key] = (weeks[key] ?? 0) + (parseLocal(e.end) - t) / 3_600_000
  }
  return weeks
}
