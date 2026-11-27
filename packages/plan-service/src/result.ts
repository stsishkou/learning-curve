/**
 * The outcome of a call on the plan that can fail in a way its caller is expected to handle: the value, or why
 * there is none. Failures a caller handles are values; a thrown error is a fault.
 */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

/** A result that worked, holding `value`. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })

/** A result that did not work, holding why in `error`. */
export const fail = <E>(error: E): Result<never, E> => ({ ok: false, error })
