/** What can be done to one open session from a list (the Today card, the week review); present where the plan can be changed. */
export interface SessionActions {
  /** Asks for the time the session took and marks it done */
  done: (uid: string) => void
  skip: (uid: string) => void
  /** Takes a skip back: the session is open work again */
  unskip: (uid: string) => void
  /** Moves the session to the next free slot; false when there is none. Times are wall-clock ms. */
  move: (session: { uid: string; calendar: string; s: number; e: number }) => boolean
}
