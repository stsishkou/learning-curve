import { DAY, HOUR, parseLocal, startOfDay, weekday, ymd } from './dates'
import { weekdaysOf } from './recurrence'
import type { Plan, PlanEvent } from './types'

export interface Occurrence extends PlanEvent {
  /** wall-clock ms */
  s: number
  e: number
}

/** Events (including weekly RRULE repeats and all-day items) that overlap [from, to). */
export function occurrences(plan: Plan, from: number, to: number, hidden: ReadonlySet<string>): Occurrence[] {
  const out: Occurrence[] = []
  for (const ev of plan.events) {
    if (hidden.has(ev.calendar)) continue
    const s = parseLocal(ev.start)
    const e = parseLocal(ev.end)
    if (ev.rrule) {
      const days = new Set(weekdaysOf(ev.rrule))
      const duration = e - s
      const timeOfDay = s - startOfDay(s)
      for (let d = Math.max(startOfDay(from), startOfDay(s)); d < to; d += DAY) {
        if (days.has(weekday(d)) && !ev.skip?.includes(ymd(d)))
          out.push({ ...ev, s: d + timeOfDay, e: d + timeOfDay + duration })
      }
    } else if (ev.allDay) {
      const d = startOfDay(s)
      if (d >= startOfDay(from) && d < to) out.push({ ...ev, s: d, e: d + DAY })
    } else if (s < to && e > from) {
      out.push({ ...ev, s, e })
    }
  }
  return out.toSorted((a, b) => a.s - b.s)
}

const NO_CALENDARS: ReadonlySet<string> = new Set()

/**
 * The busy, timed events that share time with a slot (wall-clock ms), in every calendar. `exceptUid` leaves the
 * event itself out when the slot is its own. Free time and all-day events block nothing, so they are not listed.
 */
export const overlapping = (plan: Plan, slot: { s: number; e: number }, exceptUid?: string): Occurrence[] =>
  occurrences(plan, slot.s, slot.e, NO_CALENDARS).filter(
    (o) => o.uid !== exceptUid && !o.allDay && o.availability !== 'free' && o.s < slot.e && slot.s < o.e,
  )

export const durationHours = (o: Occurrence) => (o.e - o.s) / HOUR

/** Study time that counts toward the weekly budget: busy, timed, not personal. */
export const countsToBudget = (o: Occurrence) => !o.allDay && o.availability !== 'free' && o.calendar !== 'personal'

export const planStart = (plan: Plan) =>
  parseLocal(plan.events.reduce((min, e) => (e.start < min ? e.start : min), '9999-12-31'))

export interface Lane {
  /** 0-based column inside a group of overlapping events */
  lane: number
  /** number of columns that group needs */
  lanes: number
}

/** Side-by-side columns for the timed events of one day, so overlapping events stay visible. */
export function layoutLanes(items: Occurrence[]): Map<Occurrence, Lane> {
  const result = new Map<Occurrence, Lane>()
  let group: Occurrence[] = []
  let groupEnd = -Infinity
  let laneEnds: number[] = []
  const flush = () => {
    for (const o of group) result.get(o)!.lanes = laneEnds.length
  }
  for (const o of items.toSorted((a, b) => a.s - b.s || b.e - a.e)) {
    if (o.s >= groupEnd) {
      flush()
      group = []
      laneEnds = []
      groupEnd = -Infinity
    }
    let lane = laneEnds.findIndex((end) => end <= o.s)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = o.e
    groupEnd = Math.max(groupEnd, o.e)
    group.push(o)
    result.set(o, { lane, lanes: 1 })
  }
  flush()
  return result
}
