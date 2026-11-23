/** What the lanes can ask the host to do; without it they only show. Days are `YYYY-MM-DD`. */
export interface LaneEditing {
  /** Opens Reschedule for the calendar */
  onOpen: (calendar: string) => void
  /** Moves the calendar's open sessions from today on by whole weeks */
  onMove?: ((calendar: string, days: number) => void) | undefined
  /** Asks to re-balance the calendar so that it finishes by the day */
  onFinish?: ((calendar: string, day: string) => void) | undefined
  /** Makes the day the calendar's deadline */
  onDeadline?: ((calendar: string, day: string) => void) | undefined
}
