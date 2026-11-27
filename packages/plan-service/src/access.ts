import type { PlanAccess, PlanId, UserId } from '@lc/plan-domain'

import type { Actor } from './actor'
import type { PlanFailure } from './failure'
import type { HostRules } from './ports/host'
import { fail, ok, type Result } from './result'

/**
 * What `actor` may do with `plan` on this host; every use case asks it before reading or writing. The owner reads
 * and writes their plan, and only reads it on a host that cannot be written. Anyone, signed out included, reads the
 * host's public plan. Any other plan is `not-found` to a person, so a private plan looks like no plan at all, and
 * `signed-out` to a caller nobody is signed in as.
 */
export function accessOf(
  actor: Actor,
  plan: { readonly id: PlanId; readonly owner: UserId },
  host: HostRules,
): Result<PlanAccess, PlanFailure> {
  if (actor.kind === 'person' && actor.userId === plan.owner) return ok(host.writable() ? 'owner' : 'reader')
  if (plan.id === host.publicPlan) return ok('reader')
  return fail(actor.kind === 'person' ? { kind: 'not-found' } : { kind: 'signed-out' })
}

/** Lets a write through for the plan's owner only: a reader gets `forbidden`. */
export function mustOwn(access: PlanAccess): Result<void, PlanFailure> {
  return access === 'owner' ? ok(undefined) : fail({ kind: 'forbidden' })
}
