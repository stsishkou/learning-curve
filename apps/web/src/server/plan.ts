import { parseChange, type PlanView } from '@lc/plan-domain'
import { parseChanges, parseCursor, type PlanRevision } from '@lc/plan-service'
import { createServerFn } from '@tanstack/react-start'

import { actorOf } from './actor'
import { unwrap } from './respond'
import { services } from './services'

/** The plan with what the person may do with it, the events they changed, the trash and the history. */
export const getPlanView = createServerFn({ method: 'GET' }).handler(async (): Promise<PlanView> =>
  unwrap(await services.plans.view(actorOf())),
)

/** Moves whenever the plan on disk changes, whoever changed it; null on a read-only host. */
export const getPlanRevision = createServerFn({ method: 'GET' }).handler(async (): Promise<PlanRevision | null> =>
  unwrap(await services.plans.revision(actorOf())),
)

/** Stores one change as a step of the history; each connected calendar app is sent it in the background. */
export const savePlanChange = createServerFn({ method: 'POST' })
  .validator(parseChange)
  .handler(async ({ data }): Promise<PlanView> => unwrap(await services.plans.apply(actorOf(), [data])))

/** Stores the changes of an update in order, each a step of the history; none when one does not fit. */
export const savePlanChanges = createServerFn({ method: 'POST' })
  .validator(parseChanges)
  .handler(async ({ data }): Promise<PlanView> => unwrap(await services.plans.apply(actorOf(), data)))

/** Moves the plan to a point of the history: 0 is before the first change, the number of steps the latest. */
export const travelPlanHistory = createServerFn({ method: 'POST' })
  .validator(parseCursor)
  .handler(async ({ data }): Promise<PlanView> => unwrap(await services.plans.travel(actorOf(), data)))

/** Keeps the ends of the history, the first change and the current one; the plan itself stays as it is. */
export const trimPlanHistory = createServerFn({ method: 'POST' }).handler(async (): Promise<PlanView> =>
  unwrap(await services.plans.trimHistory(actorOf())),
)
