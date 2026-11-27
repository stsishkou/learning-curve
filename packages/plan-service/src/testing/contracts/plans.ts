import { emptyEdits, parsePlanId, recordChange, parseUserId, type PlanId, type UserId } from '@lc/plan-domain'
import { describe, expect, test } from 'vitest'

import type { PlanRepository, PlanWrite, StoredPlan } from '../../ports'

const unknownPlan = parsePlanId('no-such-plan')
const stranger = parseUserId('stranger')

const written = (stored: StoredPlan, title: string, budget: number): PlanWrite => {
  const edits = { ...stored.edits, title, budget }
  return {
    edits,
    history: recordChange(stored.history, stored.plan, { type: 'plan.budget', hours: budget }, edits, undefined, 0),
    plan: { ...stored.plan, meta: { ...stored.plan.meta, title } },
  }
}

/**
 * The promises every `PlanRepository` keeps, as a Vitest suite. An adapter's tests call it with a `make` that builds
 * a fresh repository holding one plan, `seeded`, owned by `owner`, with no edits; a writable one, since saves are
 * tried.
 */
export function describePlanRepository(
  name: string,
  make: () => Promise<{ repo: PlanRepository; seeded: PlanId; owner: UserId }>,
): void {
  describe(name, () => {
    test('get returns the seeded plan and null for an unknown id', async () => {
      const { repo, seeded, owner } = await make()
      const stored = await repo.get(seeded)
      expect(stored?.id).toBe(seeded)
      expect(stored?.owner).toBe(owner)
      expect(stored?.edits).toEqual(emptyEdits())
      expect(await repo.get(unknownPlan)).toBeNull()
    })

    test('listOwned finds the plan for its owner and nothing for another', async () => {
      const { repo, seeded, owner } = await make()
      const stored = await repo.get(seeded)
      expect(await repo.listOwned(owner)).toEqual([{ id: seeded, title: stored?.plan.meta.title }])
      expect(await repo.listOwned(stranger)).toEqual([])
    })

    test('save with the read revision stores edits, history and plan and returns a new revision', async () => {
      const { repo, seeded } = await make()
      const stored = await repo.get(seeded)
      if (!stored) throw new Error('The seeded plan is missing')
      const next = written(stored, 'Written plan', 20)

      const saved = await repo.save(seeded, next, stored.revision)

      if (!saved.ok) throw new Error('The save conflicted')
      expect(saved.value).not.toBe(stored.revision)
      expect(await repo.revision(seeded)).toBe(saved.value)
      const after = await repo.get(seeded)
      expect(after?.revision).toBe(saved.value)
      expect(after?.edits).toEqual(next.edits)
      expect(next.history).not.toEqual(stored.history)
      expect(after?.history).toEqual(next.history)
      expect(after?.plan).toEqual(next.plan)
    })

    test('save with a stale revision answers conflict and get still shows the earlier write', async () => {
      const { repo, seeded } = await make()
      const stored = await repo.get(seeded)
      if (!stored) throw new Error('The seeded plan is missing')
      const first = written(stored, 'First write', 20)
      const second = written(stored, 'Second write', 30)
      const firstSave = await repo.save(seeded, first, stored.revision)
      expect(firstSave.ok).toBe(true)

      const stale = await repo.save(seeded, second, stored.revision)

      expect(stale).toEqual({ ok: false, error: 'conflict' })
      const after = await repo.get(seeded)
      expect(after?.edits).toEqual(first.edits)
      expect(after?.plan).toEqual(first.plan)
    })

    test('a value read is the caller own and a value saved is not kept by reference', async () => {
      const { repo, seeded } = await make()
      const stored = await repo.get(seeded)
      if (!stored) throw new Error('The seeded plan is missing')
      const next = written(stored, 'Kept title', 20)
      const saved = await repo.save(seeded, next, stored.revision)
      if (!saved.ok) throw new Error('The save conflicted')

      next.edits.budget = 77
      next.plan.meta.title = 'Changed after the save'
      const read = await repo.get(seeded)
      if (!read) throw new Error('The seeded plan is missing')
      read.edits.budget = 55
      read.plan.meta.title = 'Changed after the read'

      const again = await repo.get(seeded)
      expect(again?.edits.budget).toBe(20)
      expect(again?.plan.meta.title).toBe('Kept title')
    })
  })
}
