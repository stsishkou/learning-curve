import { parseUserId } from '@lc/plan-domain'
import { fixtureBase } from '@lc/plan-domain/fixtures'
import { expect, test } from 'vitest'

import { LOCAL_ACTOR, LOCAL_OWNER, type Actor } from '../actor'
import { failureMessage, type PlanFailure } from '../failure'
import type { PlanPorts } from '../ports'
import { fail, type Result } from '../result'
import { createMemoryPorts } from '../testing'
import { createPlanServices } from './create'

const T1 = Date.parse('2026-12-01T10:00:00Z')
const T2 = Date.parse('2026-12-02T10:00:00Z')
const renamed = { ...fixtureBase, meta: { ...fixtureBase.meta, title: 'Renamed' } }

const value = <T>(result: Result<T, PlanFailure>): T => {
  if (!result.ok) throw new Error(failureMessage(result.error))
  return result.value
}

/** The library of a fresh store with a clock the test moves */
function library(start = T1) {
  let now = start
  const ports: PlanPorts = { ...createMemoryPorts(), clock: { now: () => now } }
  return {
    ports,
    library: createPlanServices(ports).library,
    at: (time: number) => {
      now = time
    },
  }
}

test('library lists the last saved first, names new files plan-…, and answers not-found for an unknown file', async () => {
  const { library: files, at } = library()
  const first = value(await files.save(LOCAL_ACTOR, { name: 'First', plan: fixtureBase }))
  at(T2)
  const second = value(await files.save(LOCAL_ACTOR, { name: 'Second', plan: fixtureBase, note: 'a note' }))

  expect(first.id).toMatch(/^plan-[a-z0-9]+$/)
  expect(first.id.startsWith(`plan-${T1.toString(36)}`)).toBe(true)
  expect(second.id).not.toBe(first.id)
  expect(second.versions).toEqual([
    {
      id: `v-${T2.toString(36)}`,
      at: new Date(T2).toISOString(),
      note: 'a note',
      title: fixtureBase.meta.title,
      events: fixtureBase.events.length,
    },
  ])
  const listed = value(await files.list(LOCAL_ACTOR))
  expect(listed.map((file) => file.name)).toEqual(['Second', 'First'])

  const notFound = fail({ kind: 'not-found' })
  expect(await files.read(LOCAL_ACTOR, 'plan-unknown')).toEqual(notFound)
  expect(await files.save(LOCAL_ACTOR, { id: 'plan-unknown', name: 'X', plan: fixtureBase })).toEqual(notFound)
  expect(await files.rename(LOCAL_ACTOR, 'plan-unknown', 'X')).toEqual(notFound)
  expect(await files.remove(LOCAL_ACTOR, 'plan-unknown')).toEqual(notFound)
  expect(await files.read(LOCAL_ACTOR, first.id, 'v-unknown')).toEqual(notFound)
})

test('a file gains a version per save, reads the latest or a named one, and loses one or all of them', async () => {
  const { library: files, at } = library()
  const saved = value(await files.save(LOCAL_ACTOR, { name: 'Plan', plan: fixtureBase }))
  at(T2)
  const again = value(await files.save(LOCAL_ACTOR, { id: saved.id, name: 'Plan', plan: renamed }))
  expect(again.id).toBe(saved.id)
  expect(again.versions.map((version) => version.title)).toEqual(['Renamed', fixtureBase.meta.title])

  const oldest = again.versions.at(-1)?.id ?? ''
  expect(await files.read(LOCAL_ACTOR, saved.id)).toEqual({ ok: true, value: renamed })
  expect(await files.read(LOCAL_ACTOR, saved.id, oldest)).toEqual({ ok: true, value: fixtureBase })

  const left = value(await files.remove(LOCAL_ACTOR, saved.id, oldest))
  expect(left.map((file) => file.versions.length)).toEqual([1])
  expect(value(await files.remove(LOCAL_ACTOR, saved.id, 'v-unknown'))).toEqual(left)
  expect(value(await files.remove(LOCAL_ACTOR, saved.id))).toEqual([])
})

test('rename trims the name, caps it at 80 characters and keeps the old one when empty', async () => {
  const { library: files } = library()
  const { id } = value(await files.save(LOCAL_ACTOR, { name: 'Plan', plan: fixtureBase }))
  expect(value(await files.rename(LOCAL_ACTOR, id, '  Spaced  ')).name).toBe('Spaced')
  expect(value(await files.rename(LOCAL_ACTOR, id, 'x'.repeat(100))).name).toBe('x'.repeat(80))
  expect(value(await files.rename(LOCAL_ACTOR, id, '   ')).name).toBe('x'.repeat(80))
})

test("the library is its owner's", async () => {
  const { ports, library: files } = library()
  value(await files.save(LOCAL_ACTOR, { name: 'Plan', plan: fixtureBase }))
  const stored = await ports.library.list(LOCAL_OWNER)
  expect(stored).toHaveLength(1)
  const someone: Actor = { kind: 'person', userId: parseUserId('someone') }
  expect(await files.list(someone)).toEqual(fail({ kind: 'not-found' }))
  expect(await files.list({ kind: 'anonymous' })).toEqual(fail({ kind: 'signed-out' }))
})
