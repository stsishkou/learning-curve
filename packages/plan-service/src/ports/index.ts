import type { CalendarProvider } from '@lc/plan-domain'
import type { Solve } from '@lc/plan-domain/rebalance'

import type { BusyFeedReader } from './busy'
import type { CalendarConnector, CalendarSignIn, CalendarTokens } from './calendar'
import type { Clock } from './clock'
import type { HostRules } from './host'
import type { PlanLibrary } from './library'
import type { PlanRepository } from './plans'
import type { PrivateSettings } from './settings'
import type { SyncStateStore } from './sync-state'

export type { BusyFeedReader } from './busy'
export {
  CalendarAuthError,
  type CalendarAdapter,
  type CalendarConnector,
  type CalendarProblem,
  type CalendarSignIn,
  type CalendarTokens,
  type OAuthConfig,
  type Saved,
} from './calendar'
export type { Clock } from './clock'
export type { HostRules } from './host'
export type { PlanLibrary } from './library'
export type { PlanRepository, PlanSummary, PlanWrite, Revision, StoredPlan } from './plans'
export type { BusyFeedSetting, PrivateSettings } from './settings'
export type { SyncStateStore } from './sync-state'

/**
 * Everything the use cases need from outside: the stores, the outside services and the host's rules. Each
 * composition root (the web app, the MCP server, `pnpm run plan`) builds one and passes it in; tests pass in-memory
 * ones.
 */
export interface PlanPorts {
  readonly plans: PlanRepository
  readonly library: PlanLibrary
  readonly syncState: SyncStateStore
  readonly settings: PrivateSettings
  readonly busy: BusyFeedReader
  /** The LP solver a re-balance runs on */
  readonly solve: Solve
  /** Every calendar app the plan can be kept in */
  readonly connectors: Readonly<Record<CalendarProvider, CalendarConnector>>
  readonly calendarSignIn: CalendarSignIn
  readonly calendarTokens: CalendarTokens
  readonly clock: Clock
  readonly host: HostRules
}
