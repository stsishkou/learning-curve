import { accuracyOf, type Accuracy, type RatioSummary } from './accuracy'
import { HOUR, parseLocal } from './dates'
import type { Plan, PlanCalendar, PlanEvent } from './types'

export interface CourseProgress {
  calendar: PlanCalendar
  /** Planned study hours and how many of them are marked done */
  hours: number
  doneHours: number
  sessions: number
  doneSessions: number
  /** Hours the done sessions really took: the logged time, or the planned time where none was logged */
  spentHours: number
  /** Real hours per planned hour of the logged sessions; 1 until enough are logged to say (`MIN_LOGGED`) */
  pace: number
  /** What the logged time says, with the counts it rests on */
  accuracy: Accuracy
  /** The first session that is not done yet */
  next: PlanEvent | null
  /** Day of the last session, YYYY-MM-DD */
  finish: string
}

/** A session that can be marked done: one dated block of study, not a repeat, not free and not personal time. */
export const isSession = (e: PlanEvent) => !e.rrule && !e.allDay && e.availability !== 'free' && e.kind !== 'personal'

export const plannedHours = (e: PlanEvent) => (parseLocal(e.end) - parseLocal(e.start)) / HOUR

/** Hours a done session took: what was logged, or its planned length. */
export const spentHours = (e: PlanEvent) => (e.actual === undefined ? plannedHours(e) : e.actual / 60)

/** How long a finished session really took, in ms, when that was logged; null for anything else. */
export const realLength = (e: PlanEvent): number | null =>
  e.done && e.actual !== undefined && !e.rrule ? (e.actual * HOUR) / 60 : null

/** A session marked done with no logged time: the pace cannot count it, so the planner asks for its time. */
export const doneWithoutTime = (e: PlanEvent) => isSession(e) && e.done === true && e.actual === undefined

/** The logged sessions one session is judged against, and what they took. */
export interface ReferenceClass {
  /** `course`: the same course and kind; `kind`: the same kind in every course */
  scope: 'course' | 'kind'
  /** Logged sessions in the class */
  count: number
  typical: RatioSummary
}

/**
 * The outside view of one session: what the logged sessions most like it took, the session itself left out. The
 * same course and kind once that class has `MIN_LOGGED` logged sessions, otherwise the same kind in every course,
 * otherwise nothing (docs/estimate-accuracy-research.md, 5.2).
 */
export function referenceClass(plan: Plan, event: PlanEvent): ReferenceClass | null {
  const alike = plan.events.filter((e) => e.uid !== event.uid && isSession(e) && e.kind === event.kind)
  const course = accuracyOf(alike.filter((e) => e.calendar === event.calendar))
  if (course.typical) return { scope: 'course', count: course.logged, typical: course.typical }
  const kind = accuracyOf(alike)
  if (kind.typical) return { scope: 'kind', count: kind.logged, typical: kind.typical }
  return null
}

const hoursOf = plannedHours

/** Progress of every calendar that has sessions, in calendar order. */
export function courseProgress(plan: Plan): CourseProgress[] {
  return plan.calendars.flatMap((calendar) => {
    const sessions = plan.events.filter((e) => e.calendar === calendar.id && isSession(e))
    if (!sessions.length) return []
    const done = sessions.filter((e) => e.done)
    const doneHours = done.reduce((sum, e) => sum + hoursOf(e), 0)
    const spent = done.reduce((sum, e) => sum + spentHours(e), 0)
    const accuracy = accuracyOf(sessions)
    return [
      {
        calendar,
        hours: sessions.reduce((sum, e) => sum + hoursOf(e), 0),
        doneHours,
        spentHours: spent,
        pace: accuracy.pace ?? 1,
        accuracy,
        sessions: sessions.length,
        doneSessions: done.length,
        next: sessions.find((e) => !e.done) ?? null,
        finish: sessions.reduce((max, e) => (e.start > max ? e.start : max), '').slice(0, 10),
      },
    ]
  })
}
