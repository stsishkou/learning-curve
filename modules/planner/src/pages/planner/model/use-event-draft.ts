import { DAY, HOUR, parseLocal, toLocalString, type NewEvent, type Plan } from '@lc/plan-domain'
import { useState } from 'react'

interface Context {
  plan: Plan
  hidden: ReadonlySet<string>
  now: number | null
  weekStart: number
  canEdit: boolean
}

/** The event that is being created: where it starts out, and how its form looks right now. */
export function useEventDraft({ plan, hidden, now, weekStart, canEdit }: Context) {
  const [draft, setDraft] = useState<NewEvent | null>(null)
  // The new event as its form has it now: the grid draws this, the form keeps the fields.
  const [shown, setShown] = useState<NewEvent | null>(null)

  function begin(start?: string, end?: string, title = '') {
    if (!canEdit) return
    // Without a slot: the next full hour when today is on screen, otherwise noon of the first visible day.
    const inWeek = now !== null && now >= weekStart && now < weekStart + 7 * DAY
    const from = start ? parseLocal(start) : inWeek ? Math.ceil(now / HOUR) * HOUR : weekStart + 12 * HOUR
    const calendar = plan.calendars.find((c) => !hidden.has(c.id)) ?? plan.calendars[0]
    if (!calendar) return
    setShown(null)
    setDraft({
      calendar: calendar.id,
      title,
      description: '',
      start: toLocalString(from),
      end: end ?? toLocalString(from + HOUR),
      availability: 'busy',
    })
  }

  const drafted = draft ? (shown ?? draft) : null
  return {
    draft,
    /** The draft as the grid draws it */
    slot: drafted && {
      s: parseLocal(drafted.start),
      e: parseLocal(drafted.end),
      title: drafted.title,
      calendar: drafted.calendar,
    },
    begin,
    show: setShown,
    clear: () => (setDraft(null), setShown(null)),
  }
}
