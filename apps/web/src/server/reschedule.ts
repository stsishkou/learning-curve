import type { RebalanceResult } from '@lc/plan-domain/rebalance'
import { parseRebalanceInput } from '@lc/plan-service'
import { createServerFn } from '@tanstack/react-start'

import { actorOf } from './actor'
import { unwrap } from './respond'
import { services } from './services'

/**
 * Works out a re-balance of one calendar of the plan in view. Nothing is stored, so it runs on a read-only host too:
 * the dialog applies the moves it shows as an ordinary change.
 */
export const rebalancePlan = createServerFn({ method: 'POST' })
  .validator(parseRebalanceInput)
  .handler(async ({ data }): Promise<RebalanceResult> =>
    unwrap(await services.rebalance.rebalance(actorOf(), data.plan, data.request)),
  )
