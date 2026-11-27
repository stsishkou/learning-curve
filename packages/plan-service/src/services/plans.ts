import {
  applyChange,
  applyEdits,
  editedUids,
  emptyHistory,
  historyEdits,
  historyView,
  inSync,
  purgeTrash,
  recordChange,
  reviseEvents,
  trashOf,
  travel,
  trimHistory,
  type Plan,
  type PlanAccess,
  type PlanChange,
  type PlanEdits,
  type PlanHistory,
  type PlanId,
  type PlanView,
  type Revisions,
  type StepSource,
} from '@lc/plan-domain'
import { previewUpdate, type UpdatePreview } from '@lc/plan-domain/protocol'

import { mustOwn } from '../access'
import type { Actor } from '../actor'
import type { PlanFailure } from '../failure'
import type { PlanPorts, PlanRevision, StoredPlan } from '../ports'
import { fail, ok, type Result } from '../result'
import { openPlan, placeOf } from './place'

/** A plan regenerated from its stored base and edits, as `pnpm run plan` reports it. */
export interface PlanRebuild {
  readonly view: PlanView
  /** uids of the edited events the schedule no longer generates; their edits are kept */
  readonly orphans: readonly string[]
}

/** The plan as its calendar feeds serve it, with the version of each of its events. */
export interface PlanFeed {
  readonly plan: Plan
  readonly revisions: Revisions
}

/**
 * The plan of the actor a call is made for: a person's first own plan, or the host's public plan for anyone else.
 * No plan id crosses it. Every method can answer `signed-out` (nobody is signed in and no plan is public) or
 * `not-found` (the person has no plan and none is public). A write answers `forbidden` to a reader, as the owner is
 * on a read-only host, and `conflict` when the plan was written elsewhere twice while it ran.
 */
export interface PlanService {
  /** The plan as the actor may see it: the plan, what they may do with it, what they can undo and restore. */
  readonly view: (actor: Actor) => Promise<Result<PlanView, PlanFailure>>
  /** The plan alone, for reads that need nothing else: the guide, the accuracy report, a calendar file. */
  readonly read: (actor: Actor) => Promise<Result<Plan, PlanFailure>>
  /**
   * Moves whenever the plan is written, by anyone; the page polls it to notice writes made elsewhere. Null where
   * nothing can write the plan, so the page stops asking.
   */
  readonly revision: (actor: Actor) => Promise<Result<PlanRevision | null, PlanFailure>>
  /**
   * Stores the changes in order, each a step of the history, and answers the plan they give. None is stored when
   * one does not fit: `invalid` names it by its place in `changes`. `source` is the calendar app they were made in,
   * when not here.
   */
  readonly apply: (
    actor: Actor,
    changes: readonly PlanChange[],
    source?: StepSource,
  ) => Promise<Result<PlanView, PlanFailure>>
  /** What the changes would do to the plan; nothing is stored, so a reader may ask too. */
  readonly preview: (actor: Actor, changes: readonly PlanChange[]) => Promise<Result<UpdatePreview, PlanFailure>>
  /** Moves the plan to a step of its history: 0 is before the first change, the number of steps the latest. */
  readonly travel: (actor: Actor, cursor: number) => Promise<Result<PlanView, PlanFailure>>
  /** Keeps the ends of the history, the first change and the current one; the plan stays as it is. */
  readonly trimHistory: (actor: Actor) => Promise<Result<PlanView, PlanFailure>>
  /**
   * Regenerates the plan from its stored base and edits, purges what has outstayed the trash and keeps the history:
   * what `pnpm run plan` runs. `orphans` are the edited events the schedule no longer has.
   */
  readonly rebuild: (actor: Actor) => Promise<Result<PlanRebuild, PlanFailure>>
  /**
   * The plan for its calendar feeds, with each event's version brought up to it and kept where the host can write:
   * a change counts from the first time it is written or served.
   */
  readonly feed: (actor: Actor) => Promise<Result<PlanFeed, PlanFailure>>
}

/** The stored history, or an empty one from `edits` when they were changed past it, by hand or by `git pull`. */
const historyFor = (history: PlanHistory, edits: PlanEdits): PlanHistory =>
  inSync(history, edits) ? history : emptyHistory(edits)

/** `plan` dated as `stored` when nothing else in it changed: a save that changes nothing leaves the file as it was. */
function dated(plan: Plan, stored: Plan): Plan {
  const kept = { ...plan, meta: { ...plan.meta, generated: stored.meta.generated } }
  return JSON.stringify(kept) === JSON.stringify(stored) ? kept : plan
}

const viewOf = (
  plan: Pick<StoredPlan, 'id' | 'base' | 'edits' | 'history' | 'plan'>,
  access: PlanAccess,
  now: number,
): PlanView => ({
  id: plan.id,
  plan: plan.plan,
  access,
  edited: editedUids(plan.edits),
  trash: trashOf(plan.base, plan.edits, now),
  history: historyView(historyFor(plan.history, plan.edits)),
})

const invalid = (index: number, err: unknown): PlanFailure => ({
  kind: 'invalid',
  index,
  message: err instanceof Error ? err.message : String(err),
})

/** A write run once more, on a fresh read, when another writer saved the plan meanwhile. */
async function retried<T>(write: () => Promise<Result<T, PlanFailure>>): Promise<Result<T, PlanFailure>> {
  const first = await write()
  return !first.ok && first.error.kind === 'conflict' ? write() : first
}

/**
 * The plan service over `ports`. `afterSave` is told after `apply` and `travel` saved, so connected calendar apps can
 * be sent the change; it must not wait for them.
 */
export function createPlanService(ports: PlanPorts, afterSave: (actor: Actor) => void): PlanService {
  /** The feed revisions brought up to `plan`, kept only where the host can write. */
  async function revised(id: PlanId, plan: Plan): Promise<Revisions> {
    const stored = await ports.syncState.feedRevisions(id)
    if (!ports.host.writable()) return stored
    const next = reviseEvents(stored, plan.events, ports.clock.now())
    if (JSON.stringify(next) !== JSON.stringify(stored)) await ports.syncState.saveFeedRevisions(id, next)
    return next
  }

  /** The actor's plan as stored, for its owner to change. */
  async function owned(actor: Actor): Promise<Result<StoredPlan, PlanFailure>> {
    const opened = await openPlan(ports, actor)
    if (!opened.ok) return opened
    const allowed = mustOwn(opened.value.access)
    return allowed.ok ? ok(opened.value.stored) : allowed
  }

  /**
   * Saves `edits` over `stored` with their history, as `pnpm run plan` writes them: without what has outstayed the
   * trash, on the base the schedule gives now.
   */
  async function store(
    stored: StoredPlan,
    edits: PlanEdits,
    history: PlanHistory,
  ): Promise<Result<PlanRebuild, PlanFailure>> {
    const now = ports.clock.now()
    const kept = purgeTrash(stored.base, edits, now)
    const result = applyEdits(stored.base, kept)
    const plan = dated(result.plan, stored.plan)
    const saved = await ports.plans.save(stored.id, { edits: kept, history, plan }, stored.revision)
    if (!saved.ok) return fail({ kind: 'conflict' })
    await revised(stored.id, plan)
    return ok({ view: viewOf({ ...stored, edits: kept, history, plan }, 'owner', now), orphans: result.orphans })
  }

  /** A write that answers the plan, followed by `afterSave` once it was saved. */
  async function writeAndTell(
    actor: Actor,
    write: () => Promise<Result<PlanRebuild, PlanFailure>>,
  ): Promise<Result<PlanView, PlanFailure>> {
    const result = await retried(write)
    if (!result.ok) return result
    afterSave(actor)
    return ok(result.value.view)
  }

  return {
    view: async (actor) => {
      const opened = await openPlan(ports, actor)
      if (!opened.ok) return opened
      return ok(viewOf(opened.value.stored, opened.value.access, ports.clock.now()))
    },

    read: async (actor) => {
      const opened = await openPlan(ports, actor)
      return opened.ok ? ok(opened.value.stored.plan) : opened
    },

    revision: async (actor) => {
      const place = await placeOf(ports, actor)
      if (!place.ok) return place
      return ok(ports.host.writable() ? await ports.plans.revision(place.value.id) : null)
    },

    apply: (actor, changes, source) =>
      writeAndTell(actor, async () => {
        const stored = await owned(actor)
        if (!stored.ok) return stored
        const { base } = stored.value
        const now = ports.clock.now()
        let history = historyFor(stored.value.history, stored.value.edits)
        // Purged first, as the save purges again: the last step then holds exactly the edits stored.
        let edits = purgeTrash(base, stored.value.edits, now)
        for (const [index, change] of changes.entries()) {
          const before = applyEdits(base, edits).plan
          try {
            edits = applyChange(base, edits, change, now)
          } catch (err) {
            return fail(invalid(index, err))
          }
          history = recordChange(history, before, change, edits, source, now)
        }
        return store(stored.value, edits, history)
      }),

    preview: async (actor, changes) => {
      const opened = await openPlan(ports, actor)
      if (!opened.ok) return opened
      return ok(previewUpdate(opened.value.stored.plan, [...changes], ports.clock.now()))
    },

    travel: (actor, cursor) =>
      writeAndTell(actor, async () => {
        const stored = await owned(actor)
        if (!stored.ok) return stored
        const history = travel(historyFor(stored.value.history, stored.value.edits), cursor)
        return store(stored.value, historyEdits(history), history)
      }),

    trimHistory: (actor) =>
      retried(async () => {
        const stored = await owned(actor)
        if (!stored.ok) return stored
        const { edits, plan, revision } = stored.value
        const history = trimHistory(historyFor(stored.value.history, edits))
        const saved = await ports.plans.save(stored.value.id, { edits, history, plan }, revision)
        if (!saved.ok) return fail({ kind: 'conflict' })
        return ok(viewOf({ ...stored.value, history }, 'owner', ports.clock.now()))
      }),

    rebuild: (actor) =>
      retried(async () => {
        const stored = await owned(actor)
        if (!stored.ok) return stored
        return store(stored.value, stored.value.edits, stored.value.history)
      }),

    feed: async (actor) => {
      const opened = await openPlan(ports, actor)
      if (!opened.ok) return opened
      const { id, plan } = opened.value.stored
      return ok({ plan, revisions: await revised(id, plan) })
    },
  }
}
