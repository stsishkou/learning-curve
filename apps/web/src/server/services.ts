import { findDataDir } from '@lc/plan-data/fs'
import { localPorts } from '@lc/plan-data/local'
import { createPlanServices, type PlanServices } from '@lc/plan-service'

/**
 * Every use case on the plan, built once for the life of the server over the files of its data directory. The one
 * instance matters: the calendar sync queues its rounds inside it and joins a call to a round that waits; two would
 * meet only at the lock file, each sending its own round.
 */
export const services: PlanServices = createPlanServices(
  localPorts({ dir: findDataDir(process.cwd(), process.env), env: process.env }),
)
