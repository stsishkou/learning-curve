/** The calendar apps the plan can be kept in. */
export const CALENDAR_PROVIDERS = ['google', 'outlook'] as const

/** One of the calendar apps the plan can be kept in. */
export type CalendarProvider = (typeof CALENDAR_PROVIDERS)[number]

/** Whether a value, such as one read from a file or an address, names a calendar app. */
export const isCalendarProvider = (value: unknown): value is CalendarProvider =>
  CALENDAR_PROVIDERS.some((provider) => provider === value)
