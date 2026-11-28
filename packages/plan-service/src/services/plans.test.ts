import {
  DAY,
  applyChange,
  applyEdits,
  emptyEdits,
  emptyHistory,
  parseUserId,
  recordChange,
  type PlanChange,
} from '@lc/plan-domain'
import { fixtureBase } from '@lc/plan-domain/fixtures'
import { expect, test, vi } from 'vitest'

import { DEFAULT_PLAN, LOCAL_ACTOR, type Actor } from '../actor'
import { failureMessage, type PlanFailure } from '../failure'
import type { PlanPorts } from '../ports'
import { fail, ok, type Result } from '../result'
import { createMemoryPorts, type MemoryPorts } from '../testing'
import { createPlanServices } from './create'
import { createPlanService } from './plans'

const NOW = Date.parse('2026-12-02T09:40:00Z')
const FIRST = 'certs-001@learning-curve'
const SECOND = 'certs-002@learning-curve'
const rename = (title: string): PlanChange => ({ type: 'plan.rename', title })

const value = <T>(result: Result<T, PlanFailure>): T => {
  if (!result.ok) throw new Error(failureMessage(result.error))
  return result.value
}

test('an update whose second change does not fit stores nothing and names it', async () => {
  const ports = createMemoryPorts()
  const { plans } = createPlanServices(ports)
  const before = await ports.plans.get(DEFAULT_PLAN)
  const result = await plans.apply(LOCAL_ACTOR, [
    { type: 'plan.rename', title: 'Fine' },
    { type: 'event.remove', uid: 'no-such-event' },
  ])
  expect(result).toMatchObject({ ok: false, error: { kind: 'invalid', index: 1 } })
  expect(await ports.plans.get(DEFAULT_PLAN)).toEqual(before)
})

test('a save that meets another writer is tried again once on fresh data', async () => {
  const ports = createMemoryPorts()
  ports.conflictsLeft = 1
  const result = await createPlanServices(ports).plans.apply(LOCAL_ACTOR, [{ type: 'plan.rename', title: 'X' }])
  expect(result.ok).toBe(true)
  ports.conflictsLeft = 2
  const again = await createPlanServices(ports).plans.apply(LOCAL_ACTOR, [{ type: 'plan.rename', title: 'Y' }])
  expect(again).toEqual(fail({ kind: 'conflict' }))
})

const storedPlan = async (ports: PlanPorts) => {
  const stored = await ports.plans.get(DEFAULT_PLAN)
  if (!stored) throw new Error('No default plan')
  return stored
}

test('edits changed outside the history start the history again', async () => {
  const ports = createMemoryPorts()
  const { plans } = createPlanServices(ports)
  await plans.apply(LOCAL_ACTOR, [{ type: 'plan.rename', title: 'Renamed' }])
  const stored = await storedPlan(ports)
  // As `git pull` would leave it: other edits beside the same history.
  await ports.plans.save(
    DEFAULT_PLAN,
    { edits: emptyEdits(), history: stored.history, plan: stored.base },
    stored.revision,
  )
  expect(await plans.view(LOCAL_ACTOR)).toMatchObject({ ok: true, value: { history: { steps: [], cursor: 0 } } })
  expect(await plans.travel(LOCAL_ACTOR, 0)).toMatchObject({ ok: true })
  const after = await storedPlan(ports)
  expect(after.edits).toEqual(emptyEdits())
})

test('view shows the plan, its edited uids, its trash and its history', async () => {
  const { plans } = createPlanServices(createMemoryPorts({ now: NOW }))
  value(
    await plans.apply(LOCAL_ACTOR, [
      { type: 'event.patch', uid: FIRST, patch: { title: 'Patched' } },
      { type: 'event.remove', uid: SECOND },
    ]),
  )
  const view = value(await plans.view(LOCAL_ACTOR))
  expect(view.id).toBe(DEFAULT_PLAN)
  expect(view.access).toBe('owner')
  expect(view.plan.events.find((e) => e.uid === FIRST)?.title).toBe('Patched')
  expect(view.plan.events.some((e) => e.uid === SECOND)).toBe(false)
  expect(view.edited).toEqual([FIRST])
  expect(view.trash.events.map((trashed) => [trashed.event.uid, trashed.daysLeft])).toEqual([[SECOND, 30]])
  expect(view.history.cursor).toBe(2)
  expect(view.history.steps.map((step) => [step.change.type, step.subject, step.at])).toEqual([
    ['event.patch', fixtureBase.events.find((e) => e.uid === FIRST)?.title, new Date(NOW).toISOString()],
    ['event.remove', fixtureBase.events.find((e) => e.uid === SECOND)?.title, new Date(NOW).toISOString()],
  ])
})

test('read gives the stored plan and preview works an update out on it without storing it', async () => {
  const ports = createMemoryPorts()
  const { plans } = createPlanServices(ports)
  value(await plans.apply(LOCAL_ACTOR, [rename('Stored')]))
  const plan = value(await plans.read(LOCAL_ACTOR))
  expect(plan.meta.title).toBe('Stored')

  const before = await storedPlan(ports)
  const preview = value(await plans.preview(LOCAL_ACTOR, [rename('Previewed'), { type: 'event.remove', uid: 'none' }]))
  expect(preview.after.meta.title).toBe('Previewed')
  expect(preview.problem).toEqual({ index: 1, message: 'Unknown event "none"' })
  expect(await storedPlan(ports)).toEqual(before)
})

test('travel to 0 undoes every step and travel back redoes them', async () => {
  const ports = createMemoryPorts()
  const { plans } = createPlanServices(ports)
  value(await plans.apply(LOCAL_ACTOR, [rename('One')]))
  value(await plans.apply(LOCAL_ACTOR, [rename('Two')]))

  const undone = value(await plans.travel(LOCAL_ACTOR, 0))
  expect(undone.plan.meta.title).toBe(fixtureBase.meta.title)
  expect(undone.history.cursor).toBe(0)
  expect(undone.history.steps).toHaveLength(2)

  const redone = value(await plans.travel(LOCAL_ACTOR, 2))
  expect(redone.plan.meta.title).toBe('Two')
  const stored = await storedPlan(ports)
  expect(stored.history.cursor).toBe(2)
  expect(stored.plan.meta.title).toBe('Two')
})

test('trimHistory keeps the first and the current step', async () => {
  const ports = createMemoryPorts()
  const { plans } = createPlanServices(ports)
  for (const title of ['One', 'Two', 'Three']) {
    // oxlint-disable-next-line no-await-in-loop -- each change is a step of its own, in this order
    value(await plans.apply(LOCAL_ACTOR, [rename(title)]))
  }
  const trimmed = value(await plans.trimHistory(LOCAL_ACTOR))
  expect(trimmed.history.cursor).toBe(2)
  expect(trimmed.history.steps.map((step) => [step.subject, step.folded])).toEqual([
    ['One', undefined],
    ['Three', 1],
  ])
  expect(trimmed.plan.meta.title).toBe('Three')
  const stored = await storedPlan(ports)
  expect(stored.history.steps).toHaveLength(2)
})

test('rebuild keeps the history and reports edits for events that no longer exist', async () => {
  const removed: PlanChange = { type: 'event.patch', uid: FIRST, patch: { title: 'Kept' } }
  const edits = applyChange(fixtureBase, emptyEdits(), removed, NOW)
  const history = recordChange(emptyHistory(), fixtureBase, removed, edits, undefined, NOW)
  // The course no longer generates the event the edits were made for.
  const base = { ...fixtureBase, events: fixtureBase.events.filter((e) => e.uid !== FIRST) }
  const ports = createMemoryPorts({ base, now: NOW })
  const stored = await storedPlan(ports)
  await ports.plans.save(DEFAULT_PLAN, { edits, history, plan: applyEdits(fixtureBase, edits).plan }, stored.revision)

  const rebuilt = value(await createPlanServices(ports).plans.rebuild(LOCAL_ACTOR))
  expect(rebuilt.orphans).toEqual([FIRST])
  expect(rebuilt.view.plan.events.some((e) => e.uid === FIRST)).toBe(false)
  const after = await storedPlan(ports)
  expect(after.history).toEqual(history)
  expect(after.edits).toEqual(edits)
  expect(after.plan).toEqual(rebuilt.view.plan)
})

test('rebuild purges what has outstayed the trash', async () => {
  let now = NOW
  const ports: PlanPorts = { ...createMemoryPorts(), clock: { now: () => now } }
  const { plans } = createPlanServices(ports)
  value(await plans.apply(LOCAL_ACTOR, [{ type: 'event.remove', uid: FIRST }]))
  now = NOW + 31 * DAY
  const rebuilt = value(await plans.rebuild(LOCAL_ACTOR))
  expect(rebuilt.view.trash.events).toEqual([])
  const stored = await storedPlan(ports)
  expect(stored.edits.removed.events).toEqual({ [FIRST]: null })
})

test('the date of the plan moves only with its content', async () => {
  const fresh = { ...fixtureBase, meta: { ...fixtureBase.meta, generated: '2026-11-27' } }
  const ports = createMemoryPorts({ base: fresh })
  const stored = await storedPlan(ports)
  // Written on an earlier day, from a schedule that gives the same events today.
  await ports.plans.save(
    DEFAULT_PLAN,
    { edits: emptyEdits(), history: emptyHistory(), plan: fixtureBase },
    stored.revision,
  )
  const { plans } = createPlanServices(ports)

  const rebuilt = value(await plans.rebuild(LOCAL_ACTOR))
  expect(rebuilt.view.plan.meta.generated).toBe('2026-11-22')
  const kept = await storedPlan(ports)
  expect(kept.plan).toEqual(fixtureBase)

  const renamed = value(await plans.apply(LOCAL_ACTOR, [rename('New')]))
  expect(renamed.plan.meta.generated).toBe('2026-11-27')
})

test('feed revisions move when an event changes', async () => {
  let now = NOW
  const ports: PlanPorts = { ...createMemoryPorts(), clock: { now: () => now } }
  const { plans } = createPlanServices(ports)

  const first = value(await plans.feed(LOCAL_ACTOR))
  expect(first.plan.events).toHaveLength(fixtureBase.events.length)
  expect(first.revisions[FIRST]).toMatchObject({ seq: 0, modified: NOW })
  expect(await ports.syncState.feedRevisions(DEFAULT_PLAN)).toEqual(first.revisions)

  now = NOW + DAY
  value(await plans.apply(LOCAL_ACTOR, [{ type: 'event.patch', uid: FIRST, patch: { title: 'Patched' } }]))
  now = NOW + 2 * DAY
  const second = value(await plans.feed(LOCAL_ACTOR))
  // Counted from the save, the first time the change was written, not from this read.
  expect(second.revisions[FIRST]).toMatchObject({ seq: 1, modified: NOW + DAY })
  expect(second.revisions[SECOND]).toEqual(first.revisions[SECOND])
})

const refuse = () => Promise.reject(new Error('A write on a read-only host'))

/** The ports with every write member refusing, so a call that writes anyway fails the test. */
function refusingWrites(ports: MemoryPorts): PlanPorts {
  return {
    ...ports,
    plans: { ...ports.plans, save: refuse },
    library: { ...ports.library, put: refuse, remove: refuse },
    syncState: { ...ports.syncState, saveFeedRevisions: refuse, saveCalendarSync: refuse, exclusive: refuse },
    settings: { ...ports.settings, setBusyFeed: refuse },
  }
}

test('on a read-only host every write is forbidden and the revision is null', async () => {
  const { plans, library, busy } = createPlanServices(refusingWrites(createMemoryPorts({ writable: false })))
  const forbidden = fail({ kind: 'forbidden' })

  expect(await plans.apply(LOCAL_ACTOR, [rename('X')])).toEqual(forbidden)
  expect(await plans.travel(LOCAL_ACTOR, 0)).toEqual(forbidden)
  expect(await plans.trimHistory(LOCAL_ACTOR)).toEqual(forbidden)
  expect(await plans.rebuild(LOCAL_ACTOR)).toEqual(forbidden)
  expect(await library.save(LOCAL_ACTOR, { name: 'A', plan: fixtureBase })).toEqual(forbidden)
  expect(await library.rename(LOCAL_ACTOR, 'plan-a', 'B')).toEqual(forbidden)
  expect(await library.remove(LOCAL_ACTOR, 'plan-a')).toEqual(forbidden)
  expect(await busy.setFeed(LOCAL_ACTOR, null)).toEqual(forbidden)
  expect(failureMessage({ kind: 'forbidden' })).toBe('The plan is read-only here')

  expect(await plans.revision(LOCAL_ACTOR)).toEqual(ok(null))
  expect(await plans.view(LOCAL_ACTOR)).toMatchObject({ ok: true, value: { access: 'reader' } })
  expect(await plans.feed(LOCAL_ACTOR)).toMatchObject({ ok: true, value: { revisions: {} } })
  expect(await busy.feed(LOCAL_ACTOR)).toEqual(ok({ host: null, canSet: false }))
})

test('the revision moves with every write', async () => {
  const ports = createMemoryPorts()
  const { plans } = createPlanServices(ports)
  const before = value(await plans.revision(LOCAL_ACTOR))
  expect(before).toEqual(expect.any(String))
  value(await plans.apply(LOCAL_ACTOR, [rename('X')]))
  const after = value(await plans.revision(LOCAL_ACTOR))
  expect(after).not.toBe(before)
  const stored = await storedPlan(ports)
  expect(after).toBe(stored.revision)
})

test('a person reads their own plan, anyone the public one, and nobody another', async () => {
  const memory = createMemoryPorts()
  const someone: Actor = { kind: 'person', userId: parseUserId('someone') }
  const nobody: Actor = { kind: 'anonymous' }
  const { plans } = createPlanServices(memory)
  expect(await plans.view(someone)).toEqual(fail({ kind: 'not-found' }))
  expect(await plans.view(nobody)).toEqual(fail({ kind: 'signed-out' }))

  const shared = createPlanServices({ ...memory, host: { writable: () => true, publicPlan: DEFAULT_PLAN } }).plans
  expect(await shared.view(nobody)).toMatchObject({ ok: true, value: { id: DEFAULT_PLAN, access: 'reader' } })
  expect(await shared.view(someone)).toMatchObject({ ok: true, value: { access: 'reader' } })
  expect(await shared.apply(nobody, [rename('X')])).toEqual(fail({ kind: 'forbidden' }))
  expect(await shared.view(LOCAL_ACTOR)).toMatchObject({ ok: true, value: { access: 'owner' } })
})

test('apply and travel tell afterSave once they saved; a write that fails does not', async () => {
  const afterSave = vi.fn<(actor: Actor) => void>()
  const ports = createMemoryPorts()
  const plans = createPlanService(ports, afterSave)

  value(await plans.apply(LOCAL_ACTOR, [rename('X')]))
  value(await plans.travel(LOCAL_ACTOR, 0))
  expect(afterSave.mock.calls).toEqual([[LOCAL_ACTOR], [LOCAL_ACTOR]])

  value(await plans.trimHistory(LOCAL_ACTOR))
  value(await plans.rebuild(LOCAL_ACTOR))
  await plans.apply(LOCAL_ACTOR, [{ type: 'event.remove', uid: 'none' }])
  ports.conflictsLeft = 2
  await plans.apply(LOCAL_ACTOR, [rename('Y')])
  expect(afterSave).toHaveBeenCalledTimes(2)
})
