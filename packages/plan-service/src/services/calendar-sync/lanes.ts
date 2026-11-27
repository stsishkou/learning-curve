/** Calls to an app in flight at once */
const LANES = 6

/** Runs `work` on every item, a few at a time; after a failure nothing new starts, and the failure is thrown. */
export async function lanes<T>(items: readonly T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const failures: unknown[] = []
  const lane = async () => {
    for (let item = items.at(next++); item !== undefined && !failures.length; item = items.at(next++)) {
      try {
        // oxlint-disable-next-line no-await-in-loop -- a lane takes its items one after another
        await work(item)
      } catch (err) {
        failures.push(err)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(LANES, items.length) }, lane))
  const [failure] = failures
  if (failures.length) throw failure instanceof Error ? failure : new Error(String(failure))
}
