import { toLocalString, toMinsk, type PlanChange } from '@lc/plan-domain'

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
