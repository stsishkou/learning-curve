import { expect, test, vi } from 'vitest'

import { LOCAL_ACTOR, LOCAL_OWNER } from '../actor'
import type { PlanPorts } from '../ports'
import { fail, ok } from '../result'
import { createMemoryPorts, type MemoryPortsOptions } from '../testing'
import { createPlanServices } from './create'

const ADDRESS = 'https://cal.example/busy.ics'
const blocks = [
  { title: 'Work', s: 1000, e: 2000 },
  { title: 'Later', s: 5000, e: 6000 },
]

/** The busy service over memory ports whose busy reader records what it is asked */
function busyOf(options: MemoryPortsOptions = {}) {
  const memory = createMemoryPorts({ busy: blocks, ...options })
  const read = vi.fn(memory.busy.read)
  const ports: PlanPorts = { ...memory, busy: { read } }
  return { ports, read, busy: createPlanServices(ports).busy }
}

test('feed shows only the host of the address, and blocks reads the address over the window', async () => {
  const { busy, read } = busyOf({ busyFeed: { url: ADDRESS, fixed: false } })
  expect(await busy.feed(LOCAL_ACTOR)).toEqual(ok({ host: 'cal.example', canSet: true }))
  expect(await busy.blocks(LOCAL_ACTOR, 0, 3000)).toEqual(ok([{ title: 'Work', s: 1000, e: 2000 }]))
  expect(read).toHaveBeenCalledWith(ADDRESS, 0, 3000)
})

test('with no address there is no busy time and nothing is read', async () => {
  const { busy, read } = busyOf()
  expect(await busy.feed(LOCAL_ACTOR)).toEqual(ok({ host: null, canSet: true }))
  expect(await busy.blocks(LOCAL_ACTOR, 0, 3000)).toEqual(ok([]))
  expect(read).not.toHaveBeenCalled()
})

test('busy cannot be set when the host fixes the address', async () => {
  const { busy, ports } = busyOf({ busyFeed: { url: ADDRESS, fixed: true } })
  expect(await busy.feed(LOCAL_ACTOR)).toEqual(ok({ host: 'cal.example', canSet: false }))
  expect(await busy.setFeed(LOCAL_ACTOR, null)).toEqual(fail({ kind: 'forbidden' }))
  expect(await busy.setFeed(LOCAL_ACTOR, 'https://other.example/a.ics')).toEqual(fail({ kind: 'forbidden' }))
  expect(await ports.settings.busyFeed(LOCAL_OWNER)).toEqual({ url: ADDRESS, fixed: true })
})

test('an address is read once, fresh, before it is kept, and null forgets it', async () => {
  const { busy, read, ports } = busyOf()
  expect(await busy.setFeed(LOCAL_ACTOR, ADDRESS)).toEqual(ok({ host: 'cal.example', canSet: true }))
  expect(read).toHaveBeenCalledWith(ADDRESS, 0, 0, true)
  expect(await ports.settings.busyFeed(LOCAL_OWNER)).toEqual({ url: ADDRESS, fixed: false })

  expect(await busy.setFeed(LOCAL_ACTOR, null)).toEqual(ok({ host: null, canSet: true }))
  expect(read).toHaveBeenCalledTimes(1)
  expect(await ports.settings.busyFeed(LOCAL_OWNER)).toEqual({ url: null, fixed: false })
})

test('an address that gives no calendar is not kept', async () => {
  const { busy, read, ports } = busyOf()
  read.mockRejectedValueOnce(new Error('The address did not return a calendar file'))
  await expect(busy.setFeed(LOCAL_ACTOR, ADDRESS)).rejects.toThrow('The address did not return a calendar file')
  expect(await ports.settings.busyFeed(LOCAL_OWNER)).toEqual({ url: null, fixed: false })
})
