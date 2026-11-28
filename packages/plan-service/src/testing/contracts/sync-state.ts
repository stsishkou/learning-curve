import { parsePlanId, parseRevisions, type PlanId, type Revisions } from '@lc/plan-domain'
import { parseCalendarSync, type CalendarSync } from '@lc/plan-domain/sync'
import { describe, expect, test } from 'vitest'

import type { SyncStateStore } from '../../ports'

const otherPlan = parsePlanId('other-plan')

const revisions: Revisions = { 'event-1': { seq: 2, modified: 1_000, hash: 'abc' } }

const syncOf = (summary: string): CalendarSync => ({
  ...parseCalendarSync(null),
  calendars: { study: { id: `app-${summary}`, summary } },
})

const later = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Long enough for a waiter that polls to have looked several times. */
const WAIT_MS = 600

/** Answers 'still waiting' after `WAIT_MS`, for a holder to race against. */
async function stillWaiting(): Promise<string> {
  await later(WAIT_MS)
  return 'still waiting'
}

const nothing = (): void => undefined

/** A promise and the call that resolves it. */
function deferred() {
  let resolve = nothing
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

/**
 * The promises every `SyncStateStore` keeps, as a Vitest suite. An adapter's tests call it with a `make` that builds
 * a fresh, empty, writable store and the id of the `plan` the suite saves state for.
 */
export function describeSyncStateStore(
  name: string,
  make: () => Promise<{ store: SyncStateStore; plan: PlanId }>,
): void {
  describe(name, () => {
    test('unread state is empty', async () => {
      const { store, plan } = await make()
      expect(await store.feedRevisions(plan)).toEqual(parseRevisions(null))
      expect(await store.calendarSync(plan, 'google')).toEqual(parseCalendarSync(null))
      expect(await store.calendarSync(plan, 'outlook')).toEqual(parseCalendarSync(null))
    })

    test('saved feed revisions read back', async () => {
      const { store, plan } = await make()
      await store.saveFeedRevisions(plan, revisions)
      expect(await store.feedRevisions(plan)).toEqual(revisions)
    })

    test('a saved calendar sync reads back per provider and leaves the feed and the other app alone', async () => {
      const { store, plan } = await make()
      await store.saveFeedRevisions(plan, revisions)
      await store.saveCalendarSync(plan, 'google', syncOf('google'))
      expect(await store.calendarSync(plan, 'google')).toEqual(syncOf('google'))
      expect(await store.calendarSync(plan, 'outlook')).toEqual(parseCalendarSync(null))
      expect(await store.feedRevisions(plan)).toEqual(revisions)

      await store.saveCalendarSync(plan, 'outlook', syncOf('outlook'))
      expect(await store.calendarSync(plan, 'google')).toEqual(syncOf('google'))
      expect(await store.calendarSync(plan, 'outlook')).toEqual(syncOf('outlook'))
    })

    test('a save replaces the part whole', async () => {
      const { store, plan } = await make()
      await store.saveFeedRevisions(plan, revisions)
      await store.saveFeedRevisions(plan, {})
      expect(await store.feedRevisions(plan)).toEqual({})
    })

    test('another plan id stays empty', async () => {
      const { store, plan } = await make()
      await store.saveFeedRevisions(plan, revisions)
      await store.saveCalendarSync(plan, 'google', syncOf('google'))
      expect(await store.feedRevisions(otherPlan)).toEqual(parseRevisions(null))
      expect(await store.calendarSync(otherPlan, 'google')).toEqual(parseCalendarSync(null))
    })

    test('a value read or saved is the caller own', async () => {
      const { store, plan } = await make()
      const sync = syncOf('google')
      await store.saveCalendarSync(plan, 'google', sync)
      sync.calendars.study = { id: 'changed', summary: 'Changed after the save' }
      const read = await store.calendarSync(plan, 'google')
      read.calendars.study = { id: 'changed', summary: 'Changed after the read' }
      expect(await store.calendarSync(plan, 'google')).toEqual(syncOf('google'))
    })

    test('two holders of one plan take turns: the second works only once the first has settled', async () => {
      const { store, plan } = await make()
      const steps: string[] = []
      const inside = deferred()
      const release = deferred()
      const first = store.exclusive(plan, async () => {
        steps.push('first starts')
        inside.resolve()
        await release.promise
        steps.push('first ends')
        return 'first'
      })
      await inside.promise
      const second = store.exclusive(plan, () => {
        steps.push('second starts')
        return Promise.resolve('second')
      })
      await later(WAIT_MS)
      expect(steps).toEqual(['first starts'])
      release.resolve()
      expect(await Promise.all([first, second])).toEqual(['first', 'second'])
      expect(steps).toEqual(['first starts', 'first ends', 'second starts'])
    })

    test('a holder whose work rejects passes the rejection on and releases the lock', async () => {
      const { store, plan } = await make()
      await expect(store.exclusive(plan, () => Promise.reject(new Error('The work failed')))).rejects.toThrow(
        'The work failed',
      )
      const next = store.exclusive(plan, () => Promise.resolve('next'))
      expect(await Promise.race([next, stillWaiting()])).toBe('next')
    })

    test('a holder of another plan does not wait', async () => {
      const { store, plan } = await make()
      const release = deferred()
      const held = store.exclusive(plan, () => release.promise)
      const other = store.exclusive(otherPlan, () => Promise.resolve('other'))
      expect(await Promise.race([other, stillWaiting()])).toBe('other')
      release.resolve()
      await held
    })
  })
}
