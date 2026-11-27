import { DAY, parseLocal, toMinsk, type BusyBlock, type Plan, type UserId } from '@lc/plan-domain'
import { planRebalance, type RebalanceRequest, type RebalanceResult } from '@lc/plan-domain/rebalance'

import type { Actor } from '../actor'
import type { PlanFailure } from '../failure'
import type { PlanPorts } from '../ports'
import { newestOnly } from '../queue'
import { ok, type Result } from '../result'
import { placeOf } from './place'

/** Re-balances one calendar of the plan in view around the busy time of its owner's own calendar. */
export interface RebalanceService {
  /**
   * Works out where the sessions of `request.calendar` would go; nothing is stored, so a reader may ask too, and the
   * dialog applies the moves as an ordinary change. One request at a time: a solve takes the server's thread. A
   * request still waiting when a newer one comes is dropped and rejects with `Superseded`, since the dialog keeps
   * only the newest answer. Answers `signed-out` or `not-found` as the plan's own reads do.
   */
  readonly rebalance: (
    actor: Actor,
    plan: Plan,
    request: RebalanceRequest,
  ) => Promise<Result<RebalanceResult, PlanFailure>>
}

/** The longest horizon of a re-balance, in days, over which the busy time is read */
const HORIZON_DAYS = 367

/** The re-balance service over `ports`. */
export function createRebalanceService(ports: PlanPorts): RebalanceService {
  const queue = newestOnly()

  async function busyFrom(owner: UserId, from: string): Promise<BusyBlock[]> {
    const { url } = await ports.settings.busyFeed(owner)
    if (!url) return []
    const start = parseLocal(`${from}T00:00`)
    try {
      return [...(await ports.busy.read(url, start, start + HORIZON_DAYS * DAY))]
    } catch {
      // A calendar that does not answer must not stop a re-balance: its time is simply not known.
      return []
    }
  }

  return {
    rebalance: (actor, plan, request) => {
      const now = toMinsk(ports.clock.now())
      return queue(async (): Promise<Result<RebalanceResult, PlanFailure>> => {
        const place = await placeOf(ports, actor)
        if (!place.ok) return place
        const busy = await busyFrom(place.value.owner, request.from)
        return ok(await planRebalance(plan, request, now, busy, ports.solve))
      })
    },
  }
}
