import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { emptyEdits } from '@lc/plan-domain'
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest'

const dir = mkdtempSync(join(tmpdir(), 'lc-store-'))

// The store finds its files when it is first imported, so it is loaded after the directory is set.
const load = async () => import('./store')
let store: Awaited<ReturnType<typeof load>>

beforeAll(async () => {
  vi.stubEnv('PLAN_DATA_DIR', dir)
  store = await load()
  store.writePlan(emptyEdits())
})

afterEach(() => {
  vi.stubEnv('PLAN_READONLY', '')
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(dir, { recursive: true, force: true })
})

test('the revision moves with every stored change and stays put without one', () => {
  const first = store.planRevision()
  expect(first).toEqual(expect.any(String))
  store.saveChanges([{ type: 'plan.rename', title: 'Another name' }])
  const renamed = store.planRevision()
  expect(renamed).not.toBe(first)
  expect(store.planRevision()).toBe(renamed)
})

test('a step back in the history moves it too', () => {
  const before = store.planRevision()
  store.writeHistory({ ...store.currentHistory(), cursor: 0 })
  expect(store.planRevision()).not.toBe(before)
})

test('there is none on a read-only host: nothing there changes the plan', () => {
  vi.stubEnv('PLAN_READONLY', '1')
  expect(store.planRevision()).toBeNull()
})
