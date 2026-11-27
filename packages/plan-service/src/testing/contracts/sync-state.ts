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
  })
}
