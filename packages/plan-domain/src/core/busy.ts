/**
 * Time that is taken in the person's own calendar, read from its iCal address. It is shown behind the plan and
 * named in overlap warnings; it is never stored in the plan or exported.
 */
export interface BusyBlock {
  title: string
  /** Minsk wall-clock ms, like every time of the plan */
  s: number
  e: number
  /** Takes whole days: `s` and `e` are the starts of the first day and of the day after the last */
  allDay?: boolean
}
