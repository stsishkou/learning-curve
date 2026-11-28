import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { parseRevisions, type CalendarProvider, type PlanId } from '@lc/plan-domain'
import { parseCalendarSync } from '@lc/plan-domain/sync'
import { DEFAULT_PLAN, type SyncStateStore } from '@lc/plan-service'

import { readObject, writeJsonAtomic } from './files'
import { holdLock } from './lock'

const syncFolder = (dir: string, plan: PlanId): string => (plan === DEFAULT_PLAN ? dir : join(dir, 'plans', plan))

const syncFile = (dir: string, plan: PlanId): string => join(syncFolder(dir, plan), 'sync.json')

/**
 * What the calendar feeds and each calendar app were last given, in `sync.json`: one part for the feed and one per
 * app, each replaced whole. Local to a checkout and not committed. Another plan than `DEFAULT_PLAN` keeps its own
 * file in `plans/<id>/`.
 *
 * Beyond the port: the file is replaced by a rename, so a reader never sees half of it. The lock across processes is
 * the file `sync.lock` beside it (see `holdLock`), there only while a holder works. `calendarIds` says how an app
 * derives an event's id from its uid, for rows stored before they kept the id.
 */
export function createFsSyncState(
  dir: string,
  calendarIds: Partial<Record<CalendarProvider, (uid: string) => string>>,
): SyncStateStore {
  const writePart = (plan: PlanId, part: string, value: unknown): Promise<void> => {
    const file = syncFile(dir, plan)
    mkdirSync(dirname(file), { recursive: true })
    writeJsonAtomic(file, { ...readObject(file), [part]: value })
    return Promise.resolve()
  }
  return {
    feedRevisions: (plan) => {
      const { feed } = readObject(syncFile(dir, plan))
      return Promise.resolve(
        parseRevisions(typeof feed === 'object' && feed !== null && 'revisions' in feed ? feed.revisions : null),
      )
    },
    saveFeedRevisions: (plan, revisions) => writePart(plan, 'feed', { revisions }),
    calendarSync: (plan, provider) =>
      Promise.resolve(parseCalendarSync(readObject(syncFile(dir, plan))[provider], calendarIds[provider])),
    saveCalendarSync: (plan, provider, sync) => writePart(plan, provider, sync),
    exclusive: (plan, work) => holdLock(join(syncFolder(dir, plan), 'sync.lock'), work),
  }
}
