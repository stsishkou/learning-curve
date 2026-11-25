import { toLocalString, toMinsk, ymd, type PlanChange } from '@lc/plan-domain'

const MINUTE = 60_000
const DAY_MINUTES = 24 * 60

type FinishRecord = Pick<Extract<PlanChange, { type: 'session.finish' }>, 'actual' | 'began' | 'paused'>

/** What Finish logs: whole minutes, inside the 5 minutes to a day that a session's time may take. */
export const loggedMinutes = (ms: number) => Math.min(DAY_MINUTES, Math.max(5, Math.round(ms / MINUTE)))

/**
 * What Finish stores besides the time: the stopwatch's first start as Minsk wall-clock and the minutes it stood.
 * `elapsed` is the time it counted, `began` and `at` are epoch ms of its first start and of the finish.
 */
export const finishRecord = (elapsed: number, began: number, at: number): FinishRecord => ({
  actual: loggedMinutes(elapsed),
  began: toLocalString(toMinsk(began)),
  paused: Math.min(DAY_MINUTES, Math.max(0, Math.round((at - began - elapsed) / MINUTE))),
})

const ROUND = 5 * MINUTE

/** How long a session will probably take: its plan times what sessions like it took, to five minutes. */
export const likelyLength = (planned: number, ratio: number) => Math.round((planned * ratio) / ROUND) * ROUND

/** A run Finish asks about before it logs it, and whether it went past midnight. */
export interface LongRun {
  overnight: boolean
}

/**
 * A run longer than twice the plan or past midnight in Minsk: what a stopwatch left running looks like, and the
 * outlier that moves a course's pace most (docs/estimate-accuracy-research.md, 5.3). Null for an ordinary run.
 * `elapsed` and `planned` are ms, `began` and `at` epoch ms of the first start and of the finish.
 */
export function longRun(elapsed: number, planned: number, began: number, at: number): LongRun | null {
  const overnight = ymd(toMinsk(began)) !== ymd(toMinsk(at))
  return overnight || elapsed > 2 * planned ? { overnight } : null
}
