// Node-only: the person's own calendar, read from its iCal address, behind the `BusyFeedReader` port.
import type { BusyFeedReader } from '@lc/plan-service'

import { loadBusy } from './busy'

export { parseBusy } from './busy'

/**
 * Busy time read from an iCal address over `fetch`. A calendar fetched in the last ten minutes is read again from
 * memory, shared by every caller in the process, since calendar hosts ask not to be polled more often.
 */
export const icalBusyReader: BusyFeedReader = {
  read: (url, from, to, fresh) => loadBusy(url, from, to, fresh),
}
