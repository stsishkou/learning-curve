import { ymd } from './dates'
import type { Plan, PlanEvent } from './types'

/**
 * A calendar's deadline is its milestone event: one source that the grid, the exports, the calendar apps and the
 * rule check already know. Sessions of the calendar must end before the deadline day starts.
 */
const milestones = (plan: Plan): PlanEvent[] =>
  plan.events.filter((e) => e.kind === 'milestone').toSorted((a, b) => a.start.localeCompare(b.start))

/** The milestone that is the calendar's deadline: its earliest one; null when it has none. */
export function deadlineEvent(plan: Plan, calendar: string): PlanEvent | null {
  return milestones(plan).find((e) => e.calendar === calendar) ?? null
}

/** The day of the calendar's deadline, `YYYY-MM-DD`; null when it has none. */
export function deadlineOf(plan: Plan, calendar: string): string | null {
  return deadlineEvent(plan, calendar)?.start.slice(0, 10) ?? null
}

/** The nearest deadline from today on, across calendars; on a tie, the calendar listed first. */
export function nextDeadline(plan: Plan, now: number): { calendar: string; day: string } | null {
  const today = ymd(now)
  const order = new Map(plan.calendars.map((c, i) => [c.id, i]))
  const [first] = milestones(plan)
    .filter((e) => e.start.slice(0, 10) >= today)
    .toSorted(
      (a, b) =>
        a.start.slice(0, 10).localeCompare(b.start.slice(0, 10)) ||
        (order.get(a.calendar) ?? 0) - (order.get(b.calendar) ?? 0),
    )
  return first ? { calendar: first.calendar, day: first.start.slice(0, 10) } : null
}
