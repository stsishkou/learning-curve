// Node-only: every port of the plan for a host that runs from a checkout: the data directory's files, the person's
// iCal address, HiGHS, Google and Outlook. Nothing is read when it loads; `localPorts` is given the directory and the
// environment.
import { CALENDAR_PROVIDERS, type CalendarProvider } from '@lc/plan-domain'
import type { CalendarConnector, PlanPorts } from '@lc/plan-service'

import { createFsPorts, type FsOptions } from '../fs'
import { googleConnector } from '../google'
import { solveLp } from '../highs'
import { icalBusyReader } from '../ical'
import { outlookConnector } from '../outlook'

/** The environment variables that set a calendar app's OAuth client on a host */
const CLIENT_VARIABLES: Readonly<Record<CalendarProvider, { readonly id: string; readonly secret: string }>> = {
  google: { id: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET' },
  outlook: { id: 'OUTLOOK_CLIENT_ID', secret: 'OUTLOOK_CLIENT_SECRET' },
}

type Env = Readonly<Record<string, string | undefined>>

function clientsFrom(env: Env): FsOptions['clientsFromHost'] {
  const clients: Partial<Record<CalendarProvider, { id: string; secret: string }>> = {}
  for (const provider of CALENDAR_PROVIDERS) {
    const names = CLIENT_VARIABLES[provider]
    const id = env[names.id] ?? ''
    const secret = env[names.secret] ?? ''
    if (id || secret) clients[provider] = { id, secret }
  }
  return clients
}

function idsOf(connectors: Readonly<Record<CalendarProvider, CalendarConnector>>): FsOptions['calendarIds'] {
  const ids: Partial<Record<CalendarProvider, (uid: string) => string>> = {}
  for (const provider of CALENDAR_PROVIDERS) {
    const { idOf } = connectors[provider]
    if (idOf) ids[provider] = idOf
  }
  return ids
}

/**
 * The ports of a host that runs from a checkout, as the web app, the MCP server and `pnpm run plan` build them: the
 * files of `dir`, the iCal address of the person's own calendar, HiGHS, Google and Outlook, and the real clock. No
 * plan is public. `env` (`process.env`) may set `PLAN_READONLY=1` to switch writing off, `BUSY_ICS_URL` to fix the
 * busy-calendar address, and `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OUTLOOK_CLIENT_ID` and
 * `OUTLOOK_CLIENT_SECRET` to set the OAuth clients.
 */
export function localPorts(options: { readonly dir: string; readonly env: Env }): PlanPorts {
  const { dir, env } = options
  const connectors: Readonly<Record<CalendarProvider, CalendarConnector>> = {
    google: googleConnector,
    outlook: outlookConnector,
  }
  const fs = createFsPorts({
    dir,
    busyFeedFromHost: env.BUSY_ICS_URL || null,
    calendarIds: idsOf(connectors),
    connectors,
    clientsFromHost: clientsFrom(env),
  })
  return {
    plans: fs.plans,
    library: fs.library,
    syncState: fs.syncState,
    settings: fs.settings,
    busy: icalBusyReader,
    solve: solveLp,
    connectors,
    calendarSignIn: fs.calendarSignIn,
    calendarTokens: fs.calendarTokens,
    clock: { now: Date.now },
    host: { writable: () => env.PLAN_READONLY !== '1' && fs.canWrite(), publicPlan: null },
  }
}
