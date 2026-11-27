import type { BusyBlock } from '@lc/plan-domain'
import { parseBusyAddress, parseBusyWindow, type BusyFeed } from '@lc/plan-service'
import { createServerFn } from '@tanstack/react-start'

import { actorOf } from './actor'
import { unwrap } from './respond'
import { services } from './services'

/** Whether the address of the person's own calendar is set, and whether it can be changed here. */
export const getBusyFeed = createServerFn({ method: 'GET' }).handler(async (): Promise<BusyFeed> =>
  unwrap(await services.busy.feed(actorOf())),
)

/** Sets the address of the person's own calendar after reading it once, or forgets it when given null. */
export const saveBusyFeed = createServerFn({ method: 'POST' })
  .validator(parseBusyAddress)
  .handler(async ({ data }): Promise<BusyFeed> => unwrap(await services.busy.setFeed(actorOf(), data)))

/** The busy time of the person's own calendar between two Minsk wall-clock moments; empty when none is set. */
export const getBusy = createServerFn({ method: 'GET' })
  .validator(parseBusyWindow)
  .handler(async ({ data }): Promise<readonly BusyBlock[]> =>
    unwrap(await services.busy.blocks(actorOf(), data.from, data.to)),
  )
