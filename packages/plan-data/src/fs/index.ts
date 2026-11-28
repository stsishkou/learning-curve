// Node-only: the JSON files of a checkout behind the plan's storage ports. Import it from server code and scripts,
// never from components. Nothing is read when it loads; `createFsPorts` is given the directory.
import type { CalendarProvider } from '@lc/plan-domain'
import type {
  CalendarConnector,
  CalendarSignIn,
  CalendarTokens,
  PlanLibrary,
  PlanRepository,
  PrivateSettings,
  SyncStateStore,
} from '@lc/plan-service'

import { createFsCalendarAccounts, type HostClients } from './calendar-accounts'
import { createFsLibrary } from './library'
import { canWritePlan, createFsPlans } from './plans'
import { createFsSettings } from './settings'
import { createFsSyncState } from './sync-state'

export { bundledPlan } from './bundled'
export { findDataDir } from './files'

/** What `createFsPorts` is told. */
export interface FsOptions {
  /** The data directory, e.g. from `findDataDir`; it may be missing, and then nothing can be written */
  readonly dir: string
  /** The busy-calendar address the host sets (`BUSY_ICS_URL`), which the person cannot change; null when none */
  readonly busyFeedFromHost: string | null
  /** Per calendar app, the id of an event from its uid, for sync state stored before rows kept the id */
  readonly calendarIds: Partial<Record<CalendarProvider, (uid: string) => string>>
  /** Every calendar app, for its sign-in addresses */
  readonly connectors: Readonly<Record<CalendarProvider, CalendarConnector>>
  /**
   * Per calendar app, the OAuth client the host sets (`GOOGLE_CLIENT_ID`, …), which wins over a saved one; a field
   * left empty falls back to the saved one
   */
  readonly clientsFromHost: HostClients
}

/** The storage ports backed by the files of one data directory, and whether those files can be written. */
export interface FsPorts {
  readonly plans: PlanRepository
  readonly library: PlanLibrary
  readonly syncState: SyncStateStore
  readonly settings: PrivateSettings
  /** The host's account in each calendar app, kept in `local.json` */
  readonly calendarSignIn: CalendarSignIn
  /**
   * Access tokens to that account, from the refresh token in `local.json`; kept in memory, per process, until a minute
   * before they expire
   */
  readonly calendarTokens: CalendarTokens
  /**
   * True when the directory holds a `plan.json` this process may write; asked on every call. It does not read
   * `PLAN_READONLY`: the composition root combines the two.
   */
  readonly canWrite: () => boolean
}

/** Builds the file-backed storage ports for `options.dir`. Reads and writes nothing until a port is used. */
export function createFsPorts(options: FsOptions): FsPorts {
  const accounts = createFsCalendarAccounts(options.dir, options.connectors, options.clientsFromHost)
  return {
    plans: createFsPlans(options.dir),
    library: createFsLibrary(options.dir),
    syncState: createFsSyncState(options.dir, options.calendarIds),
    settings: createFsSettings(options.dir, options.busyFeedFromHost),
    calendarSignIn: accounts.signIn,
    calendarTokens: accounts.tokens,
    canWrite: () => canWritePlan(options.dir),
  }
}
