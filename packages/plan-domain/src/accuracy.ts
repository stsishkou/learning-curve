import { HOUR, parseLocal } from './dates'
import type { PlanEvent } from './types'

/**
 * Logged sessions a group needs before anything is said about its pace. Below six no 95% interval for a median
 * exists at all, and both Evidence-Based Scheduling and PSP wait for about that many before they estimate from
 * history (docs/estimate-accuracy-research.md, 4.1).
 */
export const MIN_LOGGED = 6

/** A ratio of real to planned time with its 95% interval. */
export interface RatioSummary {
  ratio: number
  low: number
  high: number
}

/** How far the logged time of some sessions is from their plan. */
export interface Accuracy {
  /** Sessions marked done */
  done: number
  /** Done sessions with a logged time: everything below rests on these alone */
  logged: number
  /** Planned and real hours of the logged sessions */
  loggedPlanned: number
  loggedSpent: number
  /** Real ÷ planned hours of the logged sessions, the number a forecast multiplies by; null below `MIN_LOGGED` */
  pace: number | null
  /** The pace if the done sessions without a time took their plan, as the planner used to assume; null when none */
  ifPlanned: number | null
  /** The typical session: geometric mean of real ÷ planned per logged session; null below `MIN_LOGGED` */
  typical: RatioSummary | null
}

const Z = 1.959_964

/** The 97.5% quantile of Student's t with `df` degrees of freedom, by its Cornish–Fisher expansion. */
function t975(df: number): number {
  const z3 = Z ** 3
  const z5 = Z ** 5
  const z7 = Z ** 7
  return (
    Z +
    (z3 + Z) / (4 * df) +
    (5 * z5 + 16 * z3 + 3 * Z) / (96 * df ** 2) +
    (3 * z7 + 19 * z5 + 17 * z3 - 15 * Z) / (384 * df ** 3)
  )
}

/**
 * The geometric mean and its t-interval. Ratios are read on a log scale: ×2 and ×0.5 are equally far from the plan,
 * and the mean of the logs is not pulled up by one long overrun the way the mean of the ratios is.
 */
function geometric(ratios: number[]): RatioSummary {
  const logs = ratios.map(Math.log)
  const n = logs.length
  const mean = logs.reduce((sum, x) => sum + x, 0) / n
  const sd = Math.sqrt(logs.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1))
  const half = (t975(n - 1) * sd) / Math.sqrt(n)
  return { ratio: Math.exp(mean), low: Math.exp(mean - half), high: Math.exp(mean + half) }
}

const hoursOf = (e: PlanEvent) => (parseLocal(e.end) - parseLocal(e.start)) / HOUR

/** The typical session once `count` sessions were logged. */
export interface TypicalAt {
  count: number
  typical: RatioSummary
}

/**
 * The typical session after each logged session, from the `MIN_LOGGED`th on, in the order they were really done:
 * the stopwatch's start where there is one, the planned start otherwise. A band that narrows is the estimate
 * settling; a line that leaves ×1 is a drift (docs/estimate-accuracy-research.md, view 4).
 */
export function runningTypical(sessions: readonly PlanEvent[]): TypicalAt[] {
  const ratios = sessions
    .filter((e) => e.done && e.actual !== undefined && hoursOf(e) > 0)
    .toSorted((a, b) => (a.began ?? a.start).localeCompare(b.began ?? b.start))
    .map((e) => (e.actual ?? 0) / 60 / hoursOf(e))
  return ratios.slice(MIN_LOGGED - 1).map((_, i) => ({
    count: MIN_LOGGED + i,
    typical: geometric(ratios.slice(0, MIN_LOGGED + i)),
  }))
}

/** What the logged time of `sessions` says about their planned lengths. Only the done ones count, not the skipped. */
export function accuracyOf(sessions: readonly PlanEvent[]): Accuracy {
  const done = sessions.filter((e) => e.done && !e.skipped)
  const logged = done.filter((e) => e.actual !== undefined)
  const loggedPlanned = logged.reduce((sum, e) => sum + hoursOf(e), 0)
  const loggedSpent = logged.reduce((sum, e) => sum + (e.actual ?? 0) / 60, 0)
  const enough = logged.length >= MIN_LOGGED && loggedPlanned > 0
  const unloggedPlanned = done.reduce((sum, e) => sum + (e.actual === undefined ? hoursOf(e) : 0), 0)
  return {
    done: done.length,
    logged: logged.length,
    loggedPlanned,
    loggedSpent,
    pace: enough ? loggedSpent / loggedPlanned : null,
    ifPlanned:
      enough && unloggedPlanned > 0 ? (loggedSpent + unloggedPlanned) / (loggedPlanned + unloggedPlanned) : null,
    typical: enough ? geometric(logged.map((e) => (e.actual ?? 0) / 60 / hoursOf(e))) : null,
  }
}
