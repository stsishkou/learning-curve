import { m } from '@lc/i18n/messages'
import type { HistoryStep } from '@lc/plan-domain'

/** One line that says what a step of the history did. */
export function describeStep({ change, subject }: HistoryStep): string {
  switch (change.type) {
    case 'event.add':
      return m.history_added({ name: subject })
    case 'event.remove':
    case 'calendar.remove':
      return m.trashed({ name: subject })
    case 'calendar.clear':
      return m.calendar_cleared({ name: subject })
    case 'calendar.save':
      return change.id ? m.history_calendar_changed({ name: subject }) : m.history_added({ name: subject })
    case 'trash.restore':
      return m.history_restored()
    case 'trash.empty':
      return m.history_trash_emptied()
    case 'events.shift':
      return m.history_shifted({
        days: change.days > 0 ? `+${change.days}` : change.days,
        name: subject || m.shift_all(),
      })
    case 'event.detach':
      return m.history_moved({ name: subject })
    case 'events.move':
      return m.history_replanned({ count: change.moves.length })
    case 'events.done':
      return m.history_done_many({ count: change.uids.length })
    case 'plan.rename':
      return m.history_renamed({ name: subject })
    case 'reviews.plan':
      return m.history_reviews({ name: subject })
    case 'course.add':
      return m.history_course({ name: subject, count: change.sessions.length })
    case 'events.add':
      return subject ? m.history_added({ name: subject }) : m.history_added_many({ count: change.events.length })
    case 'event.patch':
      break
  }
  const { patch } = change
  if (!patch) return m.history_reset({ name: subject })
  if (patch.done !== undefined) {
    return patch.done ? m.history_done({ name: subject }) : m.history_not_done({ name: subject })
  }
  if (patch.actual !== undefined) return m.history_spent({ name: subject })
  if (patch.skip) return m.history_skipped({ name: subject })
  const onlyTime = Object.keys(patch).every((key) => key === 'start' || key === 'end' || key === 'rrule')
  return onlyTime ? m.history_moved({ name: subject }) : m.changed_event({ title: subject })
}
