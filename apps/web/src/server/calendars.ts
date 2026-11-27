import { parseCalendarClient, parseProposalIds, parseProvider, type CalendarStatus } from '@lc/plan-service'
import { createServerFn } from '@tanstack/react-start'

import { actorOf } from './actor'
import { unwrap } from './respond'
import { services } from './services'

/** How the plan is kept in each calendar app; the client secrets and the tokens never leave the server. */
export const getCalendarStatuses = createServerFn({ method: 'GET' }).handler(
  async (): Promise<readonly CalendarStatus[]> => unwrap(await services.calendars.statuses(actorOf())),
)

/** Keeps the person's own OAuth client for a calendar app, which its sign-in then uses. */
export const saveCalendarClientFn = createServerFn({ method: 'POST' })
  .validator(parseCalendarClient)
  .handler(async ({ data }): Promise<CalendarStatus> =>
    unwrap(await services.calendars.saveClient(actorOf(), data.provider, data.id, data.secret)),
  )

/** Reads what changed in a calendar app and writes what the plan changed: one round, now. */
export const syncCalendarNow = createServerFn({ method: 'POST' })
  .validator(parseProvider)
  .handler(async ({ data }): Promise<CalendarStatus> => unwrap(await services.calendars.sync(actorOf(), data)))

export const acceptCalendarProposals = createServerFn({ method: 'POST' })
  .validator(parseProposalIds)
  .handler(async ({ data }): Promise<CalendarStatus> =>
    unwrap(await services.calendars.accept(actorOf(), data.provider, data.ids)),
  )

export const rejectCalendarProposals = createServerFn({ method: 'POST' })
  .validator(parseProposalIds)
  .handler(async ({ data }): Promise<CalendarStatus> =>
    unwrap(await services.calendars.reject(actorOf(), data.provider, data.ids)),
  )

/** Signs out of a calendar app; its calendars stay there, and connecting again picks them up. */
export const disconnectCalendarFn = createServerFn({ method: 'POST' })
  .validator(parseProvider)
  .handler(async ({ data }): Promise<CalendarStatus> => unwrap(await services.calendars.disconnect(actorOf(), data)))
