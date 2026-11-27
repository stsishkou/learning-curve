import type { BusyBlock } from '@lc/plan-domain'

/** Reads the busy time of a person's own calendar from its iCal address. */
export interface BusyFeedReader {
  /**
   * The busy blocks of the calendar at `url` between two Minsk wall-clock moments, sorted by start. Repeats are
   * expanded with their exceptions; events marked free or cancelled take no time and are left out. A reader may
   * reuse what it fetched a few minutes ago; `fresh` fetches again. Rejects when the address does not answer with a
   * calendar.
   */
  readonly read: (url: string, from: number, to: number, fresh?: boolean) => Promise<readonly BusyBlock[]>
}
