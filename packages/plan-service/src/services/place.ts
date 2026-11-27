import type { PlanAccess, PlanId, UserId } from '@lc/plan-domain'

import { accessOf, mustOwn } from '../access'
import type { Actor } from '../actor'
import type { PlanFailure } from '../failure'
import type { PlanPorts, StoredPlan } from '../ports'
import { fail, ok, type Result } from '../result'

/** The plan a call is about: its id, whose it is, and what the actor may do with it. */
export interface PlanPlace {
  readonly id: PlanId
  readonly owner: UserId
  readonly access: PlanAccess
}

function placed(
  actor: Actor,
  plan: { readonly id: PlanId; readonly owner: UserId },
  ports: PlanPorts,
): Result<PlanPlace, PlanFailure> {
  const access = accessOf(actor, plan, ports.host)
  return access.ok ? ok({ id: plan.id, owner: plan.owner, access: access.value }) : access
}

/**
 * The plan a call is about: the actor's first own plan, else the host's public plan. A person with neither gets
 * `not-found`, a caller nobody is signed in as `signed-out`. The actor's own plan is not loaded for this, because the
 * page polls the revision through it.
 */
export async function placeOf(ports: PlanPorts, actor: Actor): Promise<Result<PlanPlace, PlanFailure>> {
  if (actor.kind === 'person') {
    const [own] = await ports.plans.listOwned(actor.userId)
    if (own) return placed(actor, { id: own.id, owner: actor.userId }, ports)
  }
  const shared = ports.host.publicPlan
  if (shared === null) return fail(actor.kind === 'person' ? { kind: 'not-found' } : { kind: 'signed-out' })
  const stored = await ports.plans.get(shared)
  return stored ? placed(actor, stored, ports) : fail({ kind: 'not-found' })
}

/** As `placeOf`, for its owner to change: a reader, as anyone on a read-only host, gets `forbidden`. */
export async function ownPlace(ports: PlanPorts, actor: Actor): Promise<Result<PlanPlace, PlanFailure>> {
  const place = await placeOf(ports, actor)
  if (!place.ok) return place
  const allowed = mustOwn(place.value.access)
  return allowed.ok ? place : allowed
}

/** The plan a call is about as stored, with what the actor may do with it. */
export async function openPlan(
  ports: PlanPorts,
  actor: Actor,
): Promise<Result<{ readonly stored: StoredPlan; readonly access: PlanAccess }, PlanFailure>> {
  const place = await placeOf(ports, actor)
  if (!place.ok) return place
  const stored = await ports.plans.get(place.value.id)
  return stored ? ok({ stored, access: place.value.access }) : fail({ kind: 'not-found' })
}
