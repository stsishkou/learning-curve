import { HOUR, parseLocal } from './dates'
import type { Plan, PlanCalendar, PlanEvent } from './types'

export interface CourseProgress {
  calendar: PlanCalendar
  /** Planned study hours and how many of them are marked done */
  hours: number
  doneHours: number
  sessions: number
  doneSessions: number
  /** The first session that is not done yet */
  next: PlanEvent | null
  /** Day of the last session, YYYY-MM-DD */
  finish: string
}

/** A session that can be marked done: one dated block of study, not a repeat and not free time. */
export const isSession = (e: PlanEvent) => !e.rrule && !e.allDay && e.availability !== 'free'

const hoursOf = (e: PlanEvent) => (parseLocal(e.end) - parseLocal(e.start)) / HOUR

/** Progress of every calendar that has sessions, in calendar order. */
export function courseProgress(plan: Plan): CourseProgress[] {
  return plan.calendars.flatMap((calendar) => {
    const sessions = plan.events.filter((e) => e.calendar === calendar.id && isSession(e))
    if (!sessions.length) return []
    const done = sessions.filter((e) => e.done)
    return [
      {
        calendar,
        hours: sessions.reduce((sum, e) => sum + hoursOf(e), 0),
        doneHours: done.reduce((sum, e) => sum + hoursOf(e), 0),
        sessions: sessions.length,
        doneSessions: done.length,
        next: sessions.find((e) => !e.done) ?? null,
        finish: sessions.reduce((max, e) => (e.start > max ? e.start : max), '').slice(0, 10),
      },
    ]
  })
}
