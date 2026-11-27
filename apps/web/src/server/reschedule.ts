import { rebalanceCalendar } from '@lc/plan-data'
import { isPlan, nowMinsk, type Plan } from '@lc/plan-domain'
import { parseRebalanceRequest, type RebalanceRequest, type RebalanceResult } from '@lc/plan-domain/rebalance'
import { createServerFn } from '@tanstack/react-start'

/**
 * Works out a re-balance of one calendar of the plan in view. Nothing is stored, so it runs on a read-only host too:
 * the dialog applies the moves it shows as an ordinary change.
 */
export const rebalancePlan = createServerFn({ method: 'POST' })
  .validator((input: unknown): { plan: Plan; request: RebalanceRequest } => {
    if (typeof input !== 'object' || input === null || !('plan' in input) || !isPlan(input.plan)) {
      throw new Error('A plan is required')
    }
    const request = 'request' in input ? input.request : undefined
    return { plan: input.plan, request: parseRebalanceRequest(request, input.plan) }
  })
  .handler(({ data }): Promise<RebalanceResult> => rebalanceCalendar(data.plan, data.request, nowMinsk()))
