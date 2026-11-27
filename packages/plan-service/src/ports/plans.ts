import type { Plan, PlanEdits, PlanHistory, PlanId, UserId } from '@lc/plan-domain'

/**
 * The version of a stored plan as one read saw it. It moves whenever the plan, its edits or its history are
 * written, by anyone; two revisions are only ever compared for equality, and none is ever the word `conflict`.
 */
export type Revision = string

/** A plan as stored: the generated base, the edits on top, their history, and the revision of this read. */
export interface StoredPlan {
  readonly id: PlanId
  readonly owner: UserId
  /** The schedule the generator gives, before any edit */
  readonly base: Plan
  readonly edits: PlanEdits
  readonly history: PlanHistory
  /**
   * `base` with `edits` applied, as it was last written. A base regenerated since then shows only once the plan is
   * written again.
   */
  readonly plan: Plan
  readonly revision: Revision
}

/** What a save replaces: the edits, their history and the plan they give, together. */
export interface PlanWrite {
  readonly edits: PlanEdits
  readonly history: PlanHistory
  /** The base with `edits` applied */
  readonly plan: Plan
}

/** A plan in a list of a person's plans. */
export interface PlanSummary {
  readonly id: PlanId
  /** The plan's own title, `plan.meta.title` */
  readonly title: string
}

/**
 * Where plans are kept: the only way a use case reads or writes one. JSON files in phase 1, a database later.
 *
 * In every implementation a value read is the caller's own, and a value given to `save` is not kept by reference:
 * changing either afterwards stores nothing.
 */
export interface PlanRepository {
  /** The plan, or null when no plan has this id. */
  readonly get: (id: PlanId) => Promise<StoredPlan | null>
  /** The plans `owner` owns, oldest first, so the first is their default plan; empty when they own none. */
  readonly listOwned: (owner: UserId) => Promise<readonly PlanSummary[]>
  /**
   * The plan's revision now, the same as a `get` made since would report; cheap enough to poll, which the page does
   * to notice writes made elsewhere. Null when no plan has this id, or where the store cannot be written.
   */
  readonly revision: (id: PlanId) => Promise<Revision | null>
  /**
   * Replaces the edits, the history and the plan together, or none of them, and returns the new revision, which the
   * next `get` and `revision` report. `'conflict'`, with nothing written, when the plan was written after `expected`
   * was read: by this process, another one (the MCP server) or `pnpm run plan`. Called only where the store can be
   * written; elsewhere it may reject.
   */
  // oxlint-disable-next-line typescript/no-redundant-type-constituents -- spelled out: the caller must check for it
  readonly save: (id: PlanId, next: PlanWrite, expected: Revision) => Promise<Revision | 'conflict'>
}
