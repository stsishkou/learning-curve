/** The answer to a job dropped because a newer one came while it waited */
export class Superseded extends Error {
  constructor() {
    super('A newer request replaced this one before it started')
    this.name = 'Superseded'
  }
}

/** Settles when `work` does, resolved either way: the tail of a queue, whose next job runs whatever this one did. */
export async function ended(work: Promise<unknown>): Promise<void> {
  try {
    await work
  } catch {
    // The next job runs whether this one failed or not; its caller has the error.
  }
}

/**
 * Runs jobs one at a time, and only the newest of those waiting: a job still waiting when a newer one comes is
 * dropped and rejects with `Superseded`. The job that is running always finishes.
 */
export function newestOnly() {
  let tail: Promise<void> = Promise.resolve()
  let waiting: object | null = null
  return async <T>(job: () => Promise<T>): Promise<T> => {
    const ticket = {}
    waiting = ticket
    const before = tail
    const result = (async () => {
      await before
      if (waiting !== ticket) throw new Superseded()
      waiting = null
      return job()
    })()
    tail = ended(result)
    return result
  }
}
