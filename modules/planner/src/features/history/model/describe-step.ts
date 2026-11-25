import { fmtHours, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { parseLocal, type HistoryStep } from '@lc/plan-domain'

const sign = (n: number) => (n < 0 ? '−' : '+')

/** `+1 d 2 h`, `−1 h`: the hours carry a sign of their own only when they go the other way. */
function shiftAmount(days = 0, hours = 0): string {
  const parts: string[] = []
  if (days) parts.push(`${sign(days)}${m.duration_d({ count: Math.abs(days) })}`)
  if (hours) parts.push(`${days && sign(days) === sign(hours) ? '' : sign(hours)}${fmtHours(Math.abs(hours))}`)
  return parts.join(' ')
}

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
    case 'calendars.order':
      return m.history_calendars_ordered()
    case 'calendar.hide':
      return change.hidden ? m.history_calendar_hidden({ name: subject }) : m.history_calendar_shown({ name: subject })
    case 'calendar.labels':
      return m.history_labels_set({ name: subject })
    case 'label.rename':
      return change.to === null
        ? m.history_label_removed({ name: change.from })
        : m.history_label_renamed({ from: change.from, to: change.to })
    case 'label.hide':
      return change.hidden
        ? m.history_label_hidden({ name: change.label })
        : m.history_label_shown({ name: change.label })
    case 'trash.restore':
      return m.history_restored()
    case 'trash.empty':
      return m.history_trash_emptied()
    case 'events.shift':
      return m.history_shifted({ amount: shiftAmount(change.days, change.hours), name: subject || m.shift_all() })
    case 'event.detach':
      return m.history_moved({ name: subject })
    case 'event.split':
      return m.history_split({ name: subject, count: change.parts.length })
    case 'events.move':
      return change.reason === 'rebalance'
        ? m.history_rebalanced({ name: subject })
        : m.history_replanned({ count: change.moves.length })
    case 'events.done':
      if (subject && change.uids.length === 1) {
        return change.done ? m.history_done({ name: subject }) : m.history_not_done({ name: subject })
      }
      return m.history_done_many({ count: change.uids.length })
    case 'session.finish':
      return m.history_done({ name: subject })
    case 'plan.rename':
      return m.history_renamed({ name: subject })
    case 'plan.countdown':
      return subject ? m.history_countdown({ name: subject }) : m.history_countdown_nearest()
    case 'reviews.plan':
      return m.history_reviews({ name: subject })
    case 'week.review':
      return m.history_week_reviewed({ week: fmtShort(parseLocal(`${change.week}T00:00`)) })
    case 'course.add':
      return m.history_course({ name: subject, count: change.sessions.length })
    case 'events.add':
      return subject ? m.history_added({ name: subject }) : m.history_added_many({ count: change.events.length })
    case 'event.patch':
      break
  }
  const { patch } = change
  if (!patch) return m.history_reset({ name: subject })
  if (patch.skipped) return m.history_session_skipped({ name: subject })
  if (patch.done !== undefined) {
    return patch.done ? m.history_done({ name: subject }) : m.history_not_done({ name: subject })
  }
  if (patch.unfinished) return m.history_unfinished({ name: subject })
  if (patch.actual !== undefined) return m.history_spent({ name: subject })
  if (patch.skip) return m.history_skipped({ name: subject })
  const onlyTime = Object.keys(patch).every((key) => key === 'start' || key === 'end' || key === 'rrule')
  return onlyTime ? m.history_moved({ name: subject }) : m.changed_event({ title: subject })
}
