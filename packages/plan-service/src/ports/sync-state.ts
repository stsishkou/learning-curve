import type { CalendarProvider, PlanId, Revisions } from '@lc/plan-domain'
import type { CalendarSync } from '@lc/plan-domain/sync'

/**
 * Per plan: what its calendar feeds and each calendar app were last given, so the next feed or round can tell what
 * changed since.
 *
 * In every implementation each save replaces one part whole, or leaves it as it was, and keeps every other part: the
 * feed's, each app's, each plan's. A value read is the caller's own, and a value saved is not kept by reference, so
 * changing either afterwards stores nothing.
 */
export interface SyncStateStore {
  /** The version of each event in the plan's calendar feeds; empty (`parseRevisions(null)`) before any was saved. */
  readonly feedRevisions: (plan: PlanId) => Promise<Revisions>
  /**
   * Keeps `revisions` as the plan's feed revisions, in place of the earlier ones. Called only where the store can be
   * written: the service checks `host.writable()` first.
   */
  readonly saveFeedRevisions: (plan: PlanId, revisions: Revisions) => Promise<void>
  /** What `provider` was last given of the plan; empty (`parseCalendarSync(null)`) before its first round. */
  readonly calendarSync: (plan: PlanId, provider: CalendarProvider) => Promise<CalendarSync>
  /**
   * Keeps `sync` as what `provider` holds of the plan, in place of the earlier state. Called only where the store can
   * be written: the service checks `host.writable()` first.
   */
  readonly saveCalendarSync: (plan: PlanId, provider: CalendarProvider, sync: CalendarSync) => Promise<void>
  /**
   * Runs `work` while no other holder works on the plan's calendar sync, in this process or in any other over the
   * same store, and answers what `work` answers. The lock is released when `work` settles, resolved or rejected; a
   * holder of another plan never waits for it. A round reads the state, talks to an app and saves the state inside
   * it, so two hosts never send the same change twice. Taken only where the store can be written: the service asks
   * for it on the owner's plan, which a read-only host never gives.
   */
  readonly exclusive: <T>(plan: PlanId, work: () => Promise<T>) => Promise<T>
}
