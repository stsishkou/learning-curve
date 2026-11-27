import { addDays, type Plan } from '@lc/plan-domain'
import { defaultStudyHours, type RebalanceRequest } from '@lc/plan-domain/rebalance'

interface FinishBy {
  calendar: string
  /** First day that may change, `YYYY-MM-DD` */
  from: string
  /** The last day a session may take, `YYYY-MM-DD` */
  finishBy: string
  overBudget?: boolean | undefined
  hours?: { from: string; to: string } | undefined
}

/**
 * A re-balance that spreads the calendar's open sessions up to a day. It aims at the day after, as at a deadline,
 * so the calendar's stored deadline changes only when it is changed on its own.
 */
export function finishByRequest(
  plan: Plan,
  { calendar, from, finishBy, overBudget = false, hours = defaultStudyHours(plan) }: FinishBy,
): RebalanceRequest {
  return { calendar, from, deadline: addDays(finishBy, 1), target: { mode: 'deadline' }, overBudget, hours }
}
