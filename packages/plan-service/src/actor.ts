import { parsePlanId, parseUserId, type PlanId, type UserId } from '@lc/plan-domain'

/**
 * Who a call is made for. The server resolves it from the session cookie or an API key; it is never read from a
 * request body or a URL.
 */
export type Actor = { readonly kind: 'person'; readonly userId: UserId } | { readonly kind: 'anonymous' }

/** The one person of a host without accounts, who owns its plan. */
export const LOCAL_OWNER: UserId = parseUserId('local')

/** The local owner as the actor of a call: every call is made for them until a host has accounts. */
export const LOCAL_ACTOR: Actor = { kind: 'person', userId: LOCAL_OWNER }

/** The id of the plan a host without accounts keeps for its local owner. */
export const DEFAULT_PLAN: PlanId = parsePlanId('default')
