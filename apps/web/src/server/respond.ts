import { failureMessage, type PlanFailure, type Result } from '@lc/plan-service'

const STATUS: Readonly<Record<PlanFailure['kind'], number>> = {
  'signed-out': 401,
  forbidden: 403,
  'not-found': 404,
  conflict: 409,
  invalid: 422,
}

/** The HTTP status of a failure, as every route answers it. */
export const statusOf = (failure: PlanFailure): number => STATUS[failure.kind]

/** A failure as an `/api/*` route answers it: `{ ok: false, problem: { message } }` with its status. */
export const failed = (failure: PlanFailure): Response =>
  Response.json({ ok: false, problem: { message: failureMessage(failure) } }, { status: statusOf(failure) })

/**
 * What a server function answers for a call on the plan: its value, or its failure thrown as an error whose message
 * the page shows.
 */
export function unwrap<T>(result: Result<T, PlanFailure>): T {
  if (!result.ok) throw new Error(failureMessage(result.error))
  return result.value
}

/** What an `/api/*` route answers for a call on the plan: `ok` builds the answer from its value, else `failed`. */
export function respond<T>(result: Result<T, PlanFailure>, ok: (value: T) => Response): Response {
  return result.ok ? ok(result.value) : failed(result.error)
}
