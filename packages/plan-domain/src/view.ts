import type { HistoryView } from './history'
import type { PlanId } from './ids'
import type { PlanTrash } from './trash'
import type { Plan } from './types'

/** What a person may do with a plan: `owner` changes it, `reader` only looks. */
export type PlanAccess = 'owner' | 'reader'

/** A plan as a person sees it: the plan itself, what they may do with it, and what they can undo or restore. */
export interface PlanView {
  readonly id: PlanId
  readonly plan: Plan
  readonly access: PlanAccess
  /** The uids of the events that were changed by hand */
  readonly edited: readonly string[]
  readonly trash: PlanTrash
  readonly history: HistoryView
}
