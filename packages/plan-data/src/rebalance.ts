import {
  DAY,
  defaultStudyHours,
  parseLocal,
  parseRebalanceRequest,
  planRebalance,
  type BusyBlock,
  type Plan,
  type RebalanceRequest,
  type RebalanceResult,
} from '@lc/plan-domain'

import { loadBusy } from './busy'
import { solveLp } from './solver'
import { readBusyFeed } from './store'

let tail: Promise<void> = Promise.resolve()

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

async function ended(work: Promise<unknown>): Promise<void> {
  try {
    await work
  } catch {
    // The next request runs whether this one failed or not; its caller has the error.
  }
}

/**
 * Re-balances a calendar of `plan` with HiGHS, one request at a time: a solve blocks the server's thread, and the
 * limits of a re-balance bound each one.
 */
export function rebalanceCalendar(plan: Plan, request: RebalanceRequest, now: number): Promise<RebalanceResult> {
  const before = tail
  const result = (async () => {
    await before
    return planRebalance(plan, request, now, await busyFrom(request.from), solveLp)
  })()
  tail = ended(result)
  return result
}

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
