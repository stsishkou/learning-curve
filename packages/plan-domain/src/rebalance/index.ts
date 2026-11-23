import type { BusyBlock } from '../busy'
import { parseLocal, startOfDay, weekday } from '../dates'
import { isSession } from '../progress'
import type { SessionMove } from '../replan'
import type { Plan, PlanEvent } from '../types'
import { solveInOrder, type OrderedSolution, type Solve } from './lp'
import { beforeDeadline, buildModel, readDays } from './model'
import { placeDay } from './placement'
import { reportOf } from './report'
import { movingSessions } from './request'
import { HALF_HOUR, roomOf, type Room } from './room'
import type { RebalanceRequest, RebalanceResult } from './types'

/** The most sessions one re-balance takes: beyond it the program stops being quick to solve */
export const MAX_SESSIONS = 300
/** Solves at most this many times when fragmented free time refuses a session the day's room counted on */
const ROUNDS = 3

const minutesOf = (hhmm: string) => (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))) * 60_000
const roomHours = (e: PlanEvent) => Math.ceil((parseLocal(e.end) - parseLocal(e.start)) / HALF_HOUR - 1e-9) / 2

/**
 * The calendar's most common start on each weekday, among its sessions inside the study hours, on the half-hour grid:
 * where a session that changes day goes first. A tie goes to the earlier start.
 */
function usualStarts(plan: Plan, request: RebalanceRequest): Map<number, number> {
  const open = minutesOf(request.hours.from)
  const close = minutesOf(request.hours.to)
  const counts = new Map<number, Map<number, number>>()
  for (const e of plan.events) {
    if (e.calendar !== request.calendar || !isSession(e) || e.kind === 'review') continue
    const start = parseLocal(e.start)
    const offset = Math.round((start - startOfDay(start)) / HALF_HOUR) * HALF_HOUR
    if (offset < open || offset + (parseLocal(e.end) - start) > close) continue
    const day = counts.get(weekday(start)) ?? new Map<number, number>()
    day.set(offset, (day.get(offset) ?? 0) + 1)
    counts.set(weekday(start), day)
  }
  const usual = new Map<number, number>()
  for (const [day, offsets] of counts) {
    const [best] = [...offsets].toSorted((a, b) => b[1] - a[1] || a[0] - b[0])
    if (best) usual.set(day, best[0])
  }
  return usual
}

/** Step 3 on every day: the slots, and the room each day lacked for the sessions it could not take. */
function place(room: Room, sessions: PlanEvent[], days: (string | null)[], usual: Map<number, number>) {
  const slots = new Map<string, SessionMove>()
  const short = new Map<string, { hours: number; lab: boolean }>()
  for (const day of room.days) {
    const here = sessions.filter((_, i) => days[i] === day.day)
    if (!here.length) continue
    const { placed, failed } = placeDay(day, here, usual, room.own)
    for (const slot of placed) slots.set(slot.uid, slot)
    if (failed.length) {
      short.set(day.day, {
        hours: failed.reduce((sum, e) => sum + roomHours(e), 0),
        lab: failed.some((e) => e.kind === 'lab'),
      })
    }
  }
  return { slots: sessions.map((e) => slots.get(e.uid) ?? null), short }
}

/** The room with less on the days that could not take what the model put there. */
const lowered = (room: Room, short: Map<string, { hours: number; lab: boolean }>): Room => ({
  ...room,
  days: room.days.map((d) => {
    const lack = short.get(d.day)
    return lack ? { ...d, cap: Math.max(0, d.cap - lack.hours), lab: d.lab && !lack.lab } : d
  }),
})

/**
 * Re-balances one calendar: room (step 1), which session on which day as an integer program solved level by level
 * with the injected `solve` (step 2), and the start times (step 3). `docs/rebalancing.md` explains each step.
 *
 * `moves` lists only the sessions whose slot changes, so asking twice moves nothing the second time.
 */
export async function planRebalance(
  plan: Plan,
  request: RebalanceRequest,
  now: number,
  busy: BusyBlock[],
  solve: Solve,
): Promise<RebalanceResult> {
  const sessions = movingSessions(plan, request)
  if (sessions.length > MAX_SESSIONS) {
    throw new Error(`A re-balance takes at most ${MAX_SESSIONS} sessions; this one has ${sessions.length}`)
  }
  let room = roomOf(plan, request, sessions, now, busy)
  const budget = plan.meta.weeklyBudgetHours
  let solved: OrderedSolution = { values: {}, provenBest: true, gap: 0 }
  let slots: (SessionMove | null)[] = []
  if (sessions.length) {
    const usual = usualStarts(plan, request)
    for (let round = 1; round <= ROUNDS; round++) {
      const { model, levels, start } = buildModel(beforeDeadline(room, sessions, request), sessions, request)
      // oxlint-disable-next-line no-await-in-loop -- each round solves the room the round before it lowered
      solved = await solveInOrder(model, levels, solve, { start })
      const result = place(room, sessions, readDays(solved.values, room, sessions).days, usual)
      ;({ slots } = result)
      if (!result.short.size) break
      room = lowered(room, result.short)
    }
  }
  const moves = sessions.flatMap((e, i) => {
    const slot = slots[i]
    return slot && (slot.start !== e.start || slot.end !== e.end) ? [slot] : []
  })
  const { provenBest, gap } = solved
  return { moves, report: reportOf({ request, room, sessions, slots, moves, provenBest, gap, budget }) }
}
