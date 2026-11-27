import type { StoredPlanFile, UserId } from '@lc/plan-domain'

/**
 * A person's library: plan files they saved, each with its versions. A file's id is the library's own (`plan-…`),
 * not a plan id.
 *
 * In every implementation one owner never sees, reads or changes another's files; what `put` stores is what the
 * next read returns; and a value read or put is the caller's own, so changing it afterwards stores nothing.
 */
export interface PlanLibrary {
  /** Every file `owner` keeps, in no particular order; empty when none. */
  readonly list: (owner: UserId) => Promise<readonly StoredPlanFile[]>
  /** The file of `owner` with this id; null when there is none, also for an id no file could have. */
  readonly get: (owner: UserId, id: string) => Promise<StoredPlanFile | null>
  /** Stores `file` under its own id, whole, replacing what `owner` kept under that id. */
  readonly put: (owner: UserId, file: StoredPlanFile) => Promise<void>
  /** Removes the file with this id; removing one that is not there does nothing. */
  readonly remove: (owner: UserId, id: string) => Promise<void>
}
