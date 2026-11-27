import type { UserId } from '@lc/plan-domain'

/** The address of a person's own calendar, whose busy time is shown behind the plan, as their settings hold it. */
export interface BusyFeedSetting {
  /** The iCal address, a secret; null when none is set */
  readonly url: string | null
  /** Set by the host (`BUSY_ICS_URL`), so the person cannot change it */
  readonly fixed: boolean
}

/**
 * Per person: settings that never reach the browser. Phase 1 keeps them in `data/local.json`, readable by its owner
 * only.
 *
 * In every implementation one person never reads another's settings, and an address the host sets wins over a
 * saved one.
 */
export interface PrivateSettings {
  /** `owner`'s busy-calendar address; `{ url: null, fixed: false }` when none is set. */
  readonly busyFeed: (owner: UserId) => Promise<BusyFeedSetting>
  /**
   * Keeps `url` as `owner`'s address, as given, or forgets it when null. Checking the address is the caller's
   * job. Where the host fixes the address, the next read still gives the host's.
   */
  readonly setBusyFeed: (owner: UserId, url: string | null) => Promise<void>
}
