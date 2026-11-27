const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

/** The name of one plan: a short run of letters, digits, `_` and `-` that is safe in a file name and an address. */
export type PlanId = string & { readonly __brand: 'PlanId' }

/** The name of one person, in the same short form as a plan's. */
export type UserId = string & { readonly __brand: 'UserId' }

/** Whether a string is a well-formed plan id. */
export const isPlanId = (value: string): value is PlanId => ID.test(value)

/** Whether a string is a well-formed user id. */
export const isUserId = (value: string): value is UserId => ID.test(value)

/** The plan id a value holds; throws `Not a plan id` when it is not one. */
export function parsePlanId(value: unknown): PlanId {
  if (typeof value === 'string' && isPlanId(value)) return value
  throw new Error('Not a plan id')
}

/** The user id a value holds; throws `Not a user id` when it is not one. */
export function parseUserId(value: unknown): UserId {
  if (typeof value === 'string' && isUserId(value)) return value
  throw new Error('Not a user id')
}
