/** One target calendar in Google Calendar / Outlook. Events are imported into the calendar with the same name. */
export interface PlanCalendar {
  id: string
  name: string
  color: string
  /** true when the calendar does not exist yet and must be created before import */
  isNew: boolean
  note?: string
  /** true for a calendar added in the viewer, not defined in the course content */
  custom?: boolean
}

/** `review` is a short session that goes back to a finished module; it is planned in the viewer, not generated. */
export type EventKind = 'study' | 'lab' | 'buffer' | 'personal' | 'milestone' | 'review'

/** A single event. Times are Europe/Minsk wall-clock strings: `YYYY-MM-DDTHH:MM`. */
export interface PlanEvent {
  /** Stable id, reused as the ICS UID */
  uid: string
  calendar: string
  title: string
  start: string
  end: string
  description: string
  kind: EventKind
  /** `free` events do not block time (ICS TRANSP:TRANSPARENT) and do not count toward the weekly budget */
  availability: 'busy' | 'free'
  allDay?: boolean
  /** RFC 5545 RRULE without the `RRULE:` prefix, e.g. `FREQ=WEEKLY;BYDAY=TU,TH` */
  rrule?: string
  /** Days a repeating event does not happen, `YYYY-MM-DD`: set by hand in the viewer */
  skip?: string[]
  /** The session is finished: set by hand in the viewer */
  done?: boolean
  /** The session's length was already set to the real pace of its course: forecasts take it as it is */
  paced?: boolean
  /** Minutes the finished session really took, when that was logged; otherwise it counts as planned */
  actual?: number
}

export interface PlanMeta {
  title: string
  version: number
  timezone: string
  generated: string
  weeklyBudgetHours: number
  holidays: string[]
  planEnd: string
}

export interface Plan {
  meta: PlanMeta
  calendars: PlanCalendar[]
  events: PlanEvent[]
}

/** Shape check for a plan read from JSON: the bundled database or a file the user opens. */
export function isPlan(value: unknown): value is Plan {
  if (typeof value !== 'object' || value === null) return false
  return (
    'meta' in value &&
    typeof value.meta === 'object' &&
    value.meta !== null &&
    'calendars' in value &&
    Array.isArray(value.calendars) &&
    'events' in value &&
    Array.isArray(value.events)
  )
}

/** A course session before it gets a date. */
export interface QueueItem {
  title: string
  hours: 1 | 2
  kind: EventKind
  description: string
  availability?: 'busy' | 'free'
}
