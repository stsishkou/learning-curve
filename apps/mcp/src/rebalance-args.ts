import type { Plan } from '@lc/plan-domain'
import { defaultStudyHours, parseRebalanceRequest, type RebalanceRequest } from '@lc/plan-domain/rebalance'

/** The arguments of the MCP tool `rebalance_calendar` as a request, checked against the plan like the dialog's. */
export function requestFromTool(args: Record<string, unknown>, plan: Plan): RebalanceRequest {
  const { calendar, from, mode, perDay, deadline, overBudget, hoursFrom, hoursTo } = args
  const usual = defaultStudyHours(plan)
  const hours =
    hoursFrom === undefined && hoursTo === undefined
      ? undefined
      : { from: hoursFrom ?? usual.from, to: hoursTo ?? usual.to }
  return parseRebalanceRequest({ calendar, from, deadline, overBudget, target: { mode, perDay }, hours }, plan)
}
