/** One target calendar in Google Calendar / Outlook. Events are imported into the calendar with the same name. */
export interface PlanCalendar {
  id: string
  name: string
  color: string
  /** true when the calendar does not exist yet and must be created before import */
  isNew: boolean
  note?: string
}

export type EventKind = 'study' | 'lab' | 'buffer' | 'personal' | 'milestone'

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
}

export interface PlanMeta {
  title: string
  version: number
  timezone: string
  generated: string
  weeklyBudgetHours: number
  certDeadline: string
  holidays: string[]
  lastCertDay: string | null
  planEnd: string
}

export interface Plan {
  meta: PlanMeta
  calendars: PlanCalendar[]
  events: PlanEvent[]
}

/** A course session before it gets a date. */
export interface QueueItem {
  title: string
  hours: 1 | 2
  kind: EventKind
  description: string
  availability?: 'busy' | 'free'
}
