/**
 * Why a call on a plan did not work. Each transport maps it once: HTTP 401, 403, 404, 409 and 422 in that order, an
 * MCP tool error, or an error a server function's caller recognizes.
 */
export type PlanFailure =
  /** Needs a person and nobody is signed in */
  | { readonly kind: 'signed-out' }
  /** Signed in, but may not do this: a reader editing, or any edit on a read-only host */
  | { readonly kind: 'forbidden' }
  /** No such plan, or a private plan of someone else: the two look the same from outside */
  | { readonly kind: 'not-found' }
  /** Written elsewhere twice while this call ran */
  | { readonly kind: 'conflict' }
  /** A change that does not fit the plan, with its place in the list */
  | { readonly kind: 'invalid'; readonly index: number; readonly message: string }

/**
 * The failure in words, for a person or a log. `invalid` gives the change's own message; its place in the list is
 * the transport's to report.
 */
export function failureMessage(failure: PlanFailure): string {
  switch (failure.kind) {
    case 'signed-out':
      return 'Sign in to do this'
    case 'forbidden':
      return 'The plan is read-only here'
    case 'not-found':
      return 'Not found'
    case 'conflict':
      return 'The plan was changed elsewhere meanwhile; try again'
    case 'invalid':
      return failure.message
    default:
      return failure satisfies never
  }
}
