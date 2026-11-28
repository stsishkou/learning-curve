import { emptyEdits, emptyHistory, parsePlanId, parseUserId } from '@lc/plan-domain'
import { fixtureBase } from '@lc/plan-domain/fixtures'
import { describe, expect, test } from 'vitest'

import { DEFAULT_PLAN, LOCAL_OWNER } from '../actor'
import {
  createMemoryPorts,
  describePlanLibrary,
  describePlanRepository,
  describePrivateSettings,
  describeSyncStateStore,
} from './index'

describePlanRepository('memory PlanRepository', () =>
  Promise.resolve({ repo: createMemoryPorts().plans, seeded: DEFAULT_PLAN, owner: LOCAL_OWNER }),
)
describePlanLibrary('memory PlanLibrary', () =>
  Promise.resolve({ library: createMemoryPorts().library, owner: LOCAL_OWNER }),
)
describeSyncStateStore('memory SyncStateStore', () =>
  Promise.resolve({ store: createMemoryPorts().syncState, plan: DEFAULT_PLAN }),
)
describePrivateSettings('memory PrivateSettings', () =>
  Promise.resolve({ settings: createMemoryPorts().settings, owner: LOCAL_OWNER }),
)

describe('createMemoryPorts', () => {
  test('holds the default plan of the local owner with no edits and no history', async () => {
    const stored = await createMemoryPorts().plans.get(DEFAULT_PLAN)
    expect(stored?.owner).toBe(LOCAL_OWNER)
    expect(stored?.base).toEqual(fixtureBase)
    expect(stored?.plan).toEqual(fixtureBase)
    expect(stored?.edits).toEqual(emptyEdits())
    expect(stored?.history).toEqual(emptyHistory(emptyEdits()))
  })

  test('options.base and options.owner set the stored plan', async () => {
    const owner = parseUserId('someone')
    const base = { ...fixtureBase, meta: { ...fixtureBase.meta, title: 'Smaller' } }
    const ports = createMemoryPorts({ base, owner })
    const stored = await ports.plans.get(DEFAULT_PLAN)
    expect(stored?.plan.meta.title).toBe('Smaller')
    expect(await ports.plans.listOwned(owner)).toEqual([{ id: DEFAULT_PLAN, title: 'Smaller' }])
    expect(await ports.plans.listOwned(LOCAL_OWNER)).toEqual([])
  })

  test('conflictsLeft makes that many saves conflict without storing anything', async () => {
    const ports = createMemoryPorts()
    const stored = await ports.plans.get(DEFAULT_PLAN)
    if (!stored) throw new Error('The default plan is missing')
    const next = { edits: { ...stored.edits, budget: 20 }, history: stored.history, plan: stored.plan }
    ports.conflictsLeft = 2

    expect(await ports.plans.save(DEFAULT_PLAN, next, stored.revision)).toEqual({ ok: false, error: 'conflict' })
    expect(await ports.plans.save(DEFAULT_PLAN, next, stored.revision)).toEqual({ ok: false, error: 'conflict' })
    expect(ports.conflictsLeft).toBe(0)
    const unchanged = await ports.plans.get(DEFAULT_PLAN)
    expect(unchanged?.edits.budget).toBeUndefined()
    const third = await ports.plans.save(DEFAULT_PLAN, next, stored.revision)
    expect(third.ok).toBe(true)
  })

  test('writable false: the host says so and revision answers null, while get still has a revision', async () => {
    const ports = createMemoryPorts({ writable: false })
    expect(ports.host.writable()).toBe(false)
    expect(await ports.plans.revision(DEFAULT_PLAN)).toBeNull()
    const stored = await ports.plans.get(DEFAULT_PLAN)
    expect(typeof stored?.revision).toBe('string')
    expect(createMemoryPorts().host.writable()).toBe(true)
  })

  test('revision is null for an unknown plan', async () => {
    expect(await createMemoryPorts().plans.revision(parsePlanId('unknown'))).toBeNull()
  })

  test('the busy reader gives the blocks inside the window, sorted by start', async () => {
    const busy = [
      { title: 'late', s: 500, e: 600 },
      { title: 'early', s: 100, e: 200 },
      { title: 'outside', s: 900, e: 1000 },
    ]
    const ports = createMemoryPorts({ busy })
    const read = await ports.busy.read('https://x.example/a.ics', 0, 700)
    expect(read.map((block) => block.title)).toEqual(['early', 'late'])
  })

  test('busyFeed seeds the settings of the plan owner', async () => {
    const ports = createMemoryPorts({ busyFeed: { url: 'https://x.example/a.ics', fixed: true } })
    expect(await ports.settings.busyFeed(LOCAL_OWNER)).toEqual({ url: 'https://x.example/a.ics', fixed: true })
  })

  test('the clock is fixed by now; solve, connectors, sign-in and tokens answer as the kit says', async () => {
    const ports = createMemoryPorts({ now: 123 })
    expect(ports.clock.now()).toBe(123)
    await expect(ports.solve({ objective: [], constraints: [], variables: [] }, { timeLimit: 1 })).rejects.toThrow(
      'No solver in memory',
    )
    expect(await ports.calendarSignIn.status('google')).toEqual({ configured: false, connectedAt: null })
    await expect(ports.calendarSignIn.saveClient('google', 'id', 'secret')).rejects.toThrow(
      'No calendar apps in memory',
    )
    await expect(ports.calendarTokens.token(LOCAL_OWNER, 'google', false)).rejects.toThrow('No calendar apps in memory')
    expect(Object.keys(ports.connectors).toSorted()).toEqual(['google', 'outlook'])
  })
})
