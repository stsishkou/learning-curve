import { DAY, parseLocal } from '@lc/plan-domain'
import { fixtureBase } from '@lc/plan-domain/fixtures'
import { parseRebalanceRequest } from '@lc/plan-domain/rebalance'
import { expect, test, vi } from 'vitest'

import { LOCAL_ACTOR } from '../actor'
import type { PlanPorts } from '../ports'
import { Superseded } from '../queue'
import { fail } from '../result'
import { createMemoryPorts } from '../testing'
import { createPlanServices } from './create'

const ADDRESS = 'https://cal.example/busy.ics'
// Past the end of the plan, so nothing moves and no solver is needed.
const request = parseRebalanceRequest(
  { calendar: 'certs', from: '2027-06-01', target: { mode: 'rhythm', perDay: 1 } },
  fixtureBase,
)
const FROM = parseLocal('2027-06-01T00:00')

const tick = async () => new Promise((resolve) => setTimeout(resolve, 0))

/** A promise that settles when `open` is called, to hold a read while the test asks again */
function gate(): { wait: Promise<void>; open: () => void } {
  const held: { release?: () => void } = {}
  const wait = new Promise<void>((resolve) => {
    held.release = resolve
  })
  return { wait, open: () => held.release?.() }
}

test("rebalance uses the actor's busy time", async () => {
  const memory = createMemoryPorts({ busyFeed: { url: ADDRESS, fixed: false } })
  const read = vi.fn(memory.busy.read)
  const { rebalance } = createPlanServices({ ...memory, busy: { read } })

  const result = await rebalance.rebalance(LOCAL_ACTOR, fixtureBase, request)
  expect(result).toMatchObject({ ok: true, value: { moves: [], report: { moved: 0 } } })
  expect(read).toHaveBeenCalledWith(ADDRESS, FROM, FROM + 367 * DAY)
})

test('a calendar that does not answer leaves the busy time out, and none is read without an address', async () => {
  const memory = createMemoryPorts({ busyFeed: { url: ADDRESS, fixed: false } })
  const read = vi.fn(memory.busy.read).mockRejectedValue(new Error('The calendar answered 404'))
  const { rebalance } = createPlanServices({ ...memory, busy: { read } })
  expect(await rebalance.rebalance(LOCAL_ACTOR, fixtureBase, request)).toMatchObject({ ok: true })

  const none = createMemoryPorts()
  const unread = vi.fn(none.busy.read)
  const plain = createPlanServices({ ...none, busy: { read: unread } }).rebalance
  expect(await plain.rebalance(LOCAL_ACTOR, fixtureBase, request)).toMatchObject({ ok: true })
  expect(unread).not.toHaveBeenCalled()
})

test('rebalances run one at a time, and one still waiting when a newer one comes is dropped', async () => {
  const memory = createMemoryPorts({ busyFeed: { url: ADDRESS, fixed: false } })
  const { wait, open } = gate()
  const ports: PlanPorts = {
    ...memory,
    busy: {
      read: async (...args) => {
        await wait
        return memory.busy.read(...args)
      },
    },
  }
  const { rebalance } = createPlanServices(ports)

  const first = rebalance.rebalance(LOCAL_ACTOR, fixtureBase, request)
  await tick()
  const second = rebalance.rebalance(LOCAL_ACTOR, fixtureBase, request)
  const third = rebalance.rebalance(LOCAL_ACTOR, fixtureBase, request)
  open()
  await expect(first).resolves.toMatchObject({ ok: true })
  await expect(second).rejects.toBeInstanceOf(Superseded)
  await expect(third).resolves.toMatchObject({ ok: true })
})

test('a caller with no plan to read gets the failure', async () => {
  const { rebalance } = createPlanServices(createMemoryPorts())
  expect(await rebalance.rebalance({ kind: 'anonymous' }, fixtureBase, request)).toEqual(fail({ kind: 'signed-out' }))
})
