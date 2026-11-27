import type { PlanPorts } from '../ports'
import { createBusyService, type BusyService } from './busy'
import { createLibraryService, type LibraryService } from './library'
import { createPlanService, type PlanService } from './plans'
import { createRebalanceService, type RebalanceService } from './rebalance'

/** Every use case on the plan, built over one set of ports. */
export interface PlanServices {
  readonly plans: PlanService
  readonly library: LibraryService
  readonly busy: BusyService
  readonly rebalance: RebalanceService
}

/** Builds the services from their ports. Called once by each composition root: the web app, the MCP server, a script. */
export function createPlanServices(ports: PlanPorts): PlanServices {
  return {
    // No calendar app is sent a save from here until the calendar sync runs over these ports.
    plans: createPlanService(ports, () => undefined),
    library: createLibraryService(ports),
    busy: createBusyService(ports),
    rebalance: createRebalanceService(ports),
  }
}
