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
  /** Keeps `revisions` as the plan's feed revisions, in place of the earlier ones. */
  readonly saveFeedRevisions: (plan: PlanId, revisions: Revisions) => Promise<void>
  /** What `provider` was last given of the plan; empty (`parseCalendarSync(null)`) before its first round. */
  readonly calendarSync: (plan: PlanId, provider: CalendarProvider) => Promise<CalendarSync>
  /** Keeps `sync` as what `provider` holds of the plan, in place of the earlier state. */
  readonly saveCalendarSync: (plan: PlanId, provider: CalendarProvider, sync: CalendarSync) => Promise<void>
}
