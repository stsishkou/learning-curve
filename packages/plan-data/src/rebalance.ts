import { DAY, parseLocal, type BusyBlock, type Plan } from '@lc/plan-domain'
import {
  defaultStudyHours,
  parseRebalanceRequest,
  planRebalance,
  type RebalanceRequest,
  type RebalanceResult,
} from '@lc/plan-domain/rebalance'
import { newestOnly } from '@lc/plan-service'

import { solveLp } from './highs/solver'
import { loadBusy } from './ical/busy'
import { readBusyFeed } from './store'

const queue = newestOnly()

/** Busy time of the person's own calendar over the longest horizon; none when no feed is set or it does not answer. */
async function busyFrom(from: string): Promise<BusyBlock[]> {
  const feed = readBusyFeed()
  if (!feed) return []
  const start = parseLocal(`${from}T00:00`)
  try {
    return await loadBusy(feed, start, start + 367 * DAY)
  } catch {
    // A calendar that does not answer must not stop a re-balance: its time is simply not known.
    return []
  }
}

/**
 * Re-balances a calendar of `plan` with HiGHS, one request at a time: a solve blocks the server's thread, and the
 * limits of a re-balance bound each one. A request still waiting when a newer one comes is dropped: the dialog asks
 * again on every change and keeps only the newest answer, so a queue of old ones would only delay it.
 */
export const rebalanceCalendar = async (plan: Plan, request: RebalanceRequest, now: number): Promise<RebalanceResult> =>
  queue(async () => planRebalance(plan, request, now, await busyFrom(request.from), solveLp))

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
