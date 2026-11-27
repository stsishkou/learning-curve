import { parseUserId, type StoredPlanFile, type UserId } from '@lc/plan-domain'
import { fixtureBase } from '@lc/plan-domain/fixtures'
import { describe, expect, test } from 'vitest'

import type { PlanLibrary } from '../../ports'

const stranger = parseUserId('stranger')

const fileOf = (id: string, name: string): StoredPlanFile => ({
  version: 1,
  id,
  name,
  versions: [
    {
      id: `${id}-v1`,
      at: '2026-11-27T10:00:00.000Z',
      note: 'first',
      title: fixtureBase.meta.title,
      events: fixtureBase.events.length,
      plan: fixtureBase,
    },
  ],
})

/**
 * The promises every `PlanLibrary` keeps, as a Vitest suite. An adapter's tests call it with a `make` that builds a
 * fresh, empty, writable library and the `owner` whose files the suite puts.
 */
export function describePlanLibrary(name: string, make: () => Promise<{ library: PlanLibrary; owner: UserId }>): void {
  describe(name, () => {
    test('put then get round-trips a file, and get is null for an id nobody put', async () => {
      const { library, owner } = await make()
      const file = fileOf('plan-one', 'One')
      await library.put(owner, file)
      expect(await library.get(owner, 'plan-one')).toEqual(file)
      expect(await library.get(owner, 'plan-missing')).toBeNull()
    })

    test('list holds every file put', async () => {
      const { library, owner } = await make()
      expect(await library.list(owner)).toEqual([])
      await library.put(owner, fileOf('plan-one', 'One'))
      await library.put(owner, fileOf('plan-two', 'Two'))
      const listed = await library.list(owner)
      const names = listed.map((file) => file.name).toSorted()
      expect(names).toEqual(['One', 'Two'])
    })

    test('put replaces the file kept under the same id', async () => {
      const { library, owner } = await make()
      await library.put(owner, fileOf('plan-one', 'One'))
      await library.put(owner, fileOf('plan-one', 'Renamed'))
      const listed = await library.list(owner)
      expect(listed.map((file) => file.name)).toEqual(['Renamed'])
    })

    test('remove drops one file and does nothing for one that is not there', async () => {
      const { library, owner } = await make()
      await library.put(owner, fileOf('plan-one', 'One'))
      await library.put(owner, fileOf('plan-two', 'Two'))
      await library.remove(owner, 'plan-one')
      await library.remove(owner, 'plan-one')
      const listed = await library.list(owner)
      expect(listed.map((file) => file.id)).toEqual(['plan-two'])
      expect(await library.get(owner, 'plan-one')).toBeNull()
    })

    test('another owner sees none of the files and cannot remove them', async () => {
      const { library, owner } = await make()
      await library.put(owner, fileOf('plan-one', 'One'))
      expect(await library.list(stranger)).toEqual([])
      expect(await library.get(stranger, 'plan-one')).toBeNull()
      await library.remove(stranger, 'plan-one')
      expect(await library.get(owner, 'plan-one')).not.toBeNull()
    })

    test.each(['../plan-one', 'a/b', ''])(
      'an id no file could have, %j, reads null and removes nothing',
      async (id) => {
        const { library, owner } = await make()
        await library.put(owner, fileOf('plan-one', 'One'))
        expect(await library.get(owner, id)).toBeNull()
        await library.remove(owner, id)
        const listed = await library.list(owner)
        expect(listed.map((file) => file.id)).toEqual(['plan-one'])
      },
    )

    test('a file read or put is the caller own', async () => {
      const { library, owner } = await make()
      const file = fileOf('plan-one', 'One')
      await library.put(owner, file)
      file.name = 'Changed after the put'
      const read = await library.get(owner, 'plan-one')
      if (!read) throw new Error('The file is missing')
      read.name = 'Changed after the read'
      const again = await library.get(owner, 'plan-one')
      expect(again?.name).toBe('One')
    })
  })
}
