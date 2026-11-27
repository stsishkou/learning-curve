import {
  applyEdits,
  emptyEdits,
  emptyHistory,
  parseRevisions,
  type BusyBlock,
  type CalendarProvider,
  type Plan,
  type PlanId,
  type Revisions,
  type StoredPlanFile,
  type UserId,
} from '@lc/plan-domain'
import { fixtureBase } from '@lc/plan-domain/fixtures'
import type { Solve } from '@lc/plan-domain/rebalance'
import { parseCalendarSync, type CalendarSync } from '@lc/plan-domain/sync'

import { DEFAULT_PLAN, LOCAL_OWNER } from '../actor'
import type { BusyFeedSetting, CalendarAdapter, CalendarConnector, PlanPorts, PlanRevision, StoredPlan } from '../ports'
import { fail, ok } from '../result'

/** What `createMemoryPorts` can be told; every field is optional. */
export interface MemoryPortsOptions {
  /** The generated schedule the stored plan starts from; default: the domain's `fixtureBase` */
  readonly base?: Plan | undefined
  /** Who owns the stored plan; default: `LOCAL_OWNER` */
  readonly owner?: UserId | undefined
  /** Whether the host can write; default true. When false, `plans.revision` answers null. */
  readonly writable?: boolean | undefined
  /** The busy time the memory busy reader knows, whatever address it is asked for */
  readonly busy?: readonly BusyBlock[] | undefined
  /** The busy-calendar address the owner's settings start with */
  readonly busyFeed?: BusyFeedSetting | undefined
  /** The solver a re-balance runs on; default: one that rejects, as memory has none */
  readonly solve?: Solve | undefined
  /** The fixed time `clock.now()` gives; default: real time */
  readonly now?: number | undefined
}

/**
 * Every port in memory, for tests of use cases. `conflictsLeft` is how many `plans.save` calls answer `'conflict'`
 * first, storing nothing; a test sets it on this object to make two writers meet.
 */
export type MemoryPorts = PlanPorts & { conflictsLeft: number }

const noApps = (): Promise<never> => Promise.reject(new Error('No calendar apps in memory'))

const noAdapter: CalendarAdapter = {
  insertCalendar: noApps,
  renameCalendar: noApps,
  deleteCalendar: noApps,
  readCalendar: noApps,
  getEvent: noApps,
  insertEvent: noApps,
  patchEvent: noApps,
  moveEvent: noApps,
  deleteEvent: noApps,
  restoreRepeat: noApps,
}

const noConnector = (provider: CalendarProvider): CalendarConnector => ({
  provider,
  auth: { authorize: '', token: '', scope: '', page: {}, scopeOnToken: false, granted: () => false },
  adapter: () => noAdapter,
  problemOf: () => null,
})

const noSolver: Solve = () => Promise.reject(new Error('No solver in memory'))

/**
 * The ports of the plan held in memory: one plan, `DEFAULT_PLAN`, owned by `options.owner` (default `LOCAL_OWNER`),
 * with no edits and no history. Reads and writes copy what passes through, as every adapter must. Connectors,
 * sign-in and tokens reject with `Error('No calendar apps in memory')`. For tests of use cases; an adapter's tests
 * run the contract suites against its own ports instead.
 */
export function createMemoryPorts(options: MemoryPortsOptions = {}): MemoryPorts {
  const owner = options.owner ?? LOCAL_OWNER
  const writable = options.writable ?? true
  const base = structuredClone(options.base ?? fixtureBase)
  const edits = emptyEdits()

  let stored: StoredPlan = {
    id: DEFAULT_PLAN,
    owner,
    base,
    edits,
    history: emptyHistory(edits),
    plan: applyEdits(base, edits).plan,
    revision: 'r0',
  }
  let writes = 0

  const files = new Map<UserId, Map<string, StoredPlanFile>>()
  const feeds = new Map<PlanId, Revisions>()
  const syncs = new Map<string, CalendarSync>()
  const addresses = new Map<UserId, string>()
  if (options.busyFeed?.url) addresses.set(owner, options.busyFeed.url)
  const fixed = options.busyFeed?.fixed ?? false
  const { now } = options

  const ports: MemoryPorts = {
    conflictsLeft: 0,
    plans: {
      get: (id) => Promise.resolve(id === stored.id ? structuredClone(stored) : null),
      listOwned: (who) =>
        Promise.resolve(who === stored.owner ? [{ id: stored.id, title: stored.plan.meta.title }] : []),
      revision: (id) => Promise.resolve(writable && id === stored.id ? stored.revision : null),
      save: (id, next, expected) => {
        if (id !== stored.id) return Promise.reject(new Error(`No plan ${id} in memory`))
        if (ports.conflictsLeft > 0) {
          ports.conflictsLeft -= 1
          return Promise.resolve(fail('conflict'))
        }
        if (expected !== stored.revision) return Promise.resolve(fail('conflict'))
        writes += 1
        const revision: PlanRevision = `r${writes}`
        stored = { ...stored, ...structuredClone(next), revision }
        return Promise.resolve(ok(revision))
      },
    },
    library: {
      list: (who) => Promise.resolve(structuredClone([...(files.get(who)?.values() ?? [])])),
      get: (who, id) => Promise.resolve(structuredClone(files.get(who)?.get(id) ?? null)),
      put: (who, file) => {
        const mine = files.get(who) ?? new Map<string, StoredPlanFile>()
        mine.set(file.id, structuredClone(file))
        files.set(who, mine)
        return Promise.resolve()
      },
      remove: (who, id) => {
        files.get(who)?.delete(id)
        return Promise.resolve()
      },
    },
    syncState: {
      feedRevisions: (plan) => Promise.resolve(structuredClone(feeds.get(plan) ?? parseRevisions(null))),
      saveFeedRevisions: (plan, revisions) => {
        feeds.set(plan, structuredClone(revisions))
        return Promise.resolve()
      },
      calendarSync: (plan, provider) =>
        Promise.resolve(structuredClone(syncs.get(`${plan}/${provider}`) ?? parseCalendarSync(null))),
      saveCalendarSync: (plan, provider, sync) => {
        syncs.set(`${plan}/${provider}`, structuredClone(sync))
        return Promise.resolve()
      },
    },
    settings: {
      busyFeed: (who) => Promise.resolve({ url: addresses.get(who) ?? null, fixed }),
      setBusyFeed: (who, url) => {
        if (url === null) addresses.delete(who)
        else addresses.set(who, url)
        return Promise.resolve()
      },
    },
    busy: {
      read: (_url, from, to) =>
        Promise.resolve(
          structuredClone(
            (options.busy ?? []).filter((block) => block.e > from && block.s < to).toSorted((a, b) => a.s - b.s),
          ),
        ),
    },
    solve: options.solve ?? noSolver,
    connectors: { google: noConnector('google'), outlook: noConnector('outlook') },
    calendarSignIn: {
      status: noApps,
      saveClient: noApps,
      connectAddress: noApps,
      finishConnect: noApps,
      disconnect: noApps,
    },
    calendarTokens: { token: noApps },
    clock: { now: now === undefined ? Date.now : () => now },
    host: { writable: () => writable, publicPlan: null },
  }
  return ports
}
