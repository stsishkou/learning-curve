/** The current time; tests set it. */
export interface Clock {
  /** Real time, UTC epoch ms as `Date.now()` gives it; the plan's Minsk clock is `toMinsk(clock.now())`. */
  readonly now: () => number
}
