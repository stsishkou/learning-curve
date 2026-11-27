import { parseUserId, type UserId } from '@lc/plan-domain'
import { describe, expect, test } from 'vitest'

import type { PrivateSettings } from '../../ports'

const stranger = parseUserId('stranger')
const address = 'https://calendar.example.com/private/basic.ics'

/**
 * The promises every `PrivateSettings` keeps, as a Vitest suite. An adapter's tests call it with a `make` that builds
 * fresh, empty, writable settings, with no address fixed by the host, and the `owner` whose address the suite sets.
 */
export function describePrivateSettings(
  name: string,
  make: () => Promise<{ settings: PrivateSettings; owner: UserId }>,
): void {
  describe(name, () => {
    test('there is no address at first', async () => {
      const { settings, owner } = await make()
      expect(await settings.busyFeed(owner)).toEqual({ url: null, fixed: false })
    })

    test('a set address reads back, as given', async () => {
      const { settings, owner } = await make()
      await settings.setBusyFeed(owner, address)
      expect(await settings.busyFeed(owner)).toEqual({ url: address, fixed: false })
    })

    test('setting null forgets the address', async () => {
      const { settings, owner } = await make()
      await settings.setBusyFeed(owner, address)
      await settings.setBusyFeed(owner, null)
      expect(await settings.busyFeed(owner)).toEqual({ url: null, fixed: false })
    })

    test('another owner has no address', async () => {
      const { settings, owner } = await make()
      await settings.setBusyFeed(owner, address)
      expect(await settings.busyFeed(stranger)).toEqual({ url: null, fixed: false })
    })
  })
}
