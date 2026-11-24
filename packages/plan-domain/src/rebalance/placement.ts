import { parseLocal, toLocalString, weekday } from '../dates'
import type { SessionMove } from '../replan'
import type { PlanEvent } from '../types'
import { HALF_HOUR, type Room, type RoomDay } from './room'

const lengthOf = (e: PlanEvent) => parseLocal(e.end) - parseLocal(e.start)

/**
 * Step 3 of a re-balance: the start time of each session of one day, in their order. A session prefers, in turn:
 *
 * 1. its current slot, when its day did not change and the slot is still free (a slot outside the study hours is
 *    its own room and stays);
 * 2. the calendar's usual start for that weekday;
 * 3. the slot right after the previous session of the day;
 * 4. the free slot nearest to where the day's sessions are heading, the later one on a tie.
 *
 * Each session starts after the one before it ends, and takes whole half hours of the day's free slots. A choice is
 * taken only when the sessions after it still fit, each at its earliest start, so an early session's slot never
 * shuts out the rest of the day. A session that finds no room is returned as failed, never squeezed in.
 */
export function placeDay(
  day: RoomDay,
  sessions: PlanEvent[],
  usual: Map<number, number>,
  own: Room['own'],
): { placed: SessionMove[]; failed: PlanEvent[] } {
  const dayStart = parseLocal(`${day.day}T00:00`)
  const free = new Set(day.slots)
  const cells = (start: number, length: number) => {
    const first = dayStart + Math.floor((start - dayStart) / HALF_HOUR) * HALF_HOUR
    const out: number[] = []
    for (let cell = first; cell < start + length; cell += HALF_HOUR) out.push(cell)
    return out
  }
  const fits = (start: number, length: number, taken: Set<number>) =>
    cells(start, length).every((cell) => taken.has(cell))
  const typical = usual.get(weekday(dayStart))
  const outsideOf = (e: PlanEvent) => {
    const current = own.get(e.uid)
    return current?.day === day.day && current.outside ? current : undefined
  }

  /** Whether the sessions from `k` on fit in order after `end`, each where it ends soonest */
  const restFits = (k: number, end: number, taken: Set<number>) => {
    const left = new Set(taken)
    let previous = end
    for (const e of sessions.slice(k)) {
      const length = lengthOf(e)
      const inside = day.slots.find((s) => s >= previous && fits(s, length, left))
      const outside = outsideOf(e)
      const kept = outside && outside.start >= previous ? outside : undefined
      if (kept && (inside === undefined || kept.end <= inside + length)) {
        previous = kept.end
        continue
      }
      if (inside === undefined) return false
      for (const cell of cells(inside, length)) left.delete(cell)
      previous = inside + length
    }
    return true
  }

  const placed: SessionMove[] = []
  const failed: PlanEvent[] = []
  let previousEnd = Number.NEGATIVE_INFINITY
  for (const [k, e] of sessions.entries()) {
    const length = lengthOf(e)
    const current = own.get(e.uid)
    const stays = current?.day === day.day
    const after = Number.isFinite(previousEnd) ? Math.ceil(previousEnd / HALF_HOUR) * HALF_HOUR : undefined
    const toward = after ?? (typical === undefined ? undefined : dayStart + typical) ?? day.slots[0] ?? dayStart
    const nearest = day.slots.toSorted((a, b) => Math.abs(a - toward) - Math.abs(b - toward) || b - a)
    const candidates = [
      ...(stays ? [{ start: current.start, inside: !current.outside }] : []),
      ...[
        ...(typical === undefined ? [] : [dayStart + typical]),
        ...(after === undefined ? [] : [after]),
        ...nearest,
      ].map((start) => ({ start, inside: true })),
    ].filter(({ start, inside }) => start >= previousEnd && (!inside || fits(start, length, free)))
    const leaving = (c: { start: number; inside: boolean }) => {
      if (!c.inside) return free
      const taken = new Set(free)
      for (const cell of cells(c.start, length)) taken.delete(cell)
      return taken
    }
    const chosen = candidates.find((c) => restFits(k + 1, c.start + length, leaving(c))) ?? candidates[0]
    if (!chosen) {
      failed.push(e)
      continue
    }
    if (chosen.inside) for (const cell of cells(chosen.start, length)) free.delete(cell)
    placed.push({ uid: e.uid, start: toLocalString(chosen.start), end: toLocalString(chosen.start + length) })
    previousEnd = chosen.start + length
  }
  return { placed, failed }
}
