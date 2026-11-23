import { deadlineEvent, type Plan, type PlanChange } from '@lc/plan-domain'

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
