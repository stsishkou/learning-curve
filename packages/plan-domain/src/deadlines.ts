import type { PlanChange } from './changes'
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

/** The deadline a countdown counts to. `chosen`: the plan names the calendar; `day` is null while it has none. */
export interface Countdown {
  calendar: string
  day: string | null
  chosen: boolean
}

/**
 * The deadline the countdown follows: of the calendar the plan names, even before it has one or after it is over;
 * the nearest one from today on when the plan names none or its calendar is gone. Null when there is nothing to count to.
 */
export function countdown(plan: Plan, now: number): Countdown | null {
  const named = plan.meta.countdown
  if (named && plan.calendars.some((c) => c.id === named)) {
    return { calendar: named, day: deadlineOf(plan, named), chosen: true }
  }
  const next = nextDeadline(plan, now)
  return next && { ...next, chosen: false }
}

/**
 * The change that makes `day` (`YYYY-MM-DD`) the calendar's deadline: its milestone is added, moved, or removed to
 * the trash when `day` is null. null when the deadline stays as it is.
 */
export function deadlineChange(plan: Plan, calendar: string, day: string | null): PlanChange | null {
  const current = deadlineEvent(plan, calendar)
  if (day === null) return current ? { type: 'event.remove', uid: current.uid } : null
  const midnight = `${day}T00:00`
  if (!current) {
    const name = plan.calendars.find((c) => c.id === calendar)?.name ?? calendar
    return {
      type: 'event.add',
      event: {
        calendar,
        title: `Дедлайн: ${name}`,
        start: midnight,
        end: midnight,
        description: '',
        availability: 'free',
        kind: 'milestone',
      },
    }
  }
  if (current.start.slice(0, 10) === day) return null
  return { type: 'event.patch', uid: current.uid, patch: { start: midnight, end: midnight } }
}
