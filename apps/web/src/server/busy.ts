import { canWrite, feedAddress, loadBusy, readBusyFeed, writeBusyFeed } from '@lc/plan-data'
import { DAY, type BusyBlock } from '@lc/plan-domain'
import { createServerFn } from '@tanstack/react-start'

export interface BusyFeed {
  /** Host of the calendar address that is set, null when none is. The address itself is a secret and stays here. */
  host: string | null
  /** false where the address cannot be changed: a read-only host, or one that sets it with `BUSY_ICS_URL` */
  canSet: boolean
}

/** The longest stretch read at once: a month grid is six weeks */
const MAX_WINDOW = 62 * DAY

const address = () => feedAddress(readBusyFeed() ?? '')

function feed(): BusyFeed {
  const url = address()
  return { host: url ? new URL(url).host : null, canSet: canWrite() && !process.env.BUSY_ICS_URL }
}

export const getBusyFeed = createServerFn({ method: 'GET' }).handler((): BusyFeed => feed())

/** Sets the address of the person's own calendar after reading it once, or forgets it when given null. */
export const saveBusyFeed = createServerFn({ method: 'POST' })
  .validator((url: unknown) => {
    if (url === null) return null
    const valid = typeof url === 'string' ? feedAddress(url) : null
    if (!valid) throw new Error('An https or webcal address of an iCal file is required')
    return valid
  })
  .handler(async ({ data }): Promise<BusyFeed> => {
    if (!feed().canSet) throw new Error('The calendar address cannot be changed here')
    if (data) await loadBusy(data, 0, 0, true)
    writeBusyFeed(data)
    return feed()
  })

/** The busy time of the person's own calendar between two Minsk wall-clock moments; empty when none is set. */
export const getBusy = createServerFn({ method: 'GET' })
  .validator((range: unknown) => {
    if (typeof range !== 'object' || range === null || !('from' in range) || !('to' in range)) {
      throw new Error('A window is required')
    }
    const { from, to } = range
    if (typeof from !== 'number' || typeof to !== 'number' || !(to > from) || to - from > MAX_WINDOW) {
      throw new Error('A window of at most two months is required')
    }
    return { from, to }
  })
  .handler(async ({ data }): Promise<BusyBlock[]> => {
    const url = address()
    return url ? loadBusy(url, data.from, data.to) : []
  })
