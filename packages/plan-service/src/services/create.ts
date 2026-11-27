import type { PlanPorts } from '../ports'
import { createBusyService, type BusyService } from './busy'
import { createCalendarSyncService, type CalendarSyncService } from './calendar-sync/service'
import { createLibraryService, type LibraryService } from './library'
import { createPlanService, type PlanService } from './plans'
import { createRebalanceService, type RebalanceService } from './rebalance'

/** Every use case on the plan, built over one set of ports. */
export interface PlanServices {
  readonly plans: PlanService
  readonly library: LibraryService
  readonly busy: BusyService
  readonly rebalance: RebalanceService
  readonly calendars: CalendarSyncService
}

/** Builds the services from their ports. Called once by each composition root: the web app, the MCP server, a script. */
export function createPlanServices(ports: PlanPorts): PlanServices {
  // A round stores the edits it takes in from an app: telling the apps of that save would start another round.
  const calendars = createCalendarSyncService(
    ports,
    createPlanService(ports, () => undefined),
  )
  return {
    plans: createPlanService(ports, (actor) => void calendars.syncAll(actor)),
    library: createLibraryService(ports),
    busy: createBusyService(ports),
    rebalance: createRebalanceService(ports),
    calendars,
  }
}
