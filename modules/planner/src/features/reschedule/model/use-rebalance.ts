import type { Plan } from '@lc/plan-domain'
import type { RebalanceRequest, RebalanceResult } from '@lc/plan-domain/rebalance'
import { useEffect, useRef, useState } from 'react'

export type Rebalance = (plan: Plan, request: RebalanceRequest) => Promise<RebalanceResult>

/** Waits this long after the last change of an input before asking: typing a time asks once, not per key. */
const DEBOUNCE_MS = 300

interface Answer {
  /** The request it answers, as JSON */
  asked: string
  result: RebalanceResult | null
  error: string
}

/**
 * The re-balance of `request`, asked for again whenever it changes. Only the answer to the newest request is kept:
 * a slow answer to an older one arrives later and is dropped. While a newer one is worked out, the last answer stays.
 */
export function useRebalance(
  rebalance: Rebalance | undefined,
  plan: Plan,
  request: RebalanceRequest | null,
): { result: RebalanceResult | null; working: boolean; error: string } {
  const [answer, setAnswer] = useState<Answer | null>(null)
  const newest = useRef(0)
  const asked = request && rebalance ? JSON.stringify(request) : null

  useEffect(() => {
    const id = ++newest.current
    if (!request || !rebalance) return undefined
    const key = JSON.stringify(request)
    async function ask(work: Rebalance, what: RebalanceRequest) {
      try {
        const result = await work(plan, what)
        if (id === newest.current) setAnswer({ asked: key, result, error: '' })
      } catch (err) {
        if (id === newest.current)
          setAnswer({ asked: key, result: null, error: err instanceof Error ? err.message : String(err) })
      }
    }
    const timer = setTimeout(() => void ask(rebalance, request), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [rebalance, plan, request])

  if (asked === null) return { result: null, working: false, error: '' }
  const current = answer?.asked === asked
  return { result: answer?.result ?? null, working: !current, error: current ? answer.error : '' }
}
