import { DAY, HOUR, parseLocal, startOfDay, weekday } from './dates'
import type { Plan, PlanEvent } from './types'

export interface Occurrence extends PlanEvent {
  /** wall-clock ms */
  s: number
  e: number
}

const BYDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

/** Events (including weekly RRULE repeats and all-day items) that overlap [from, to). */
export function occurrences(plan: Plan, from: number, to: number, hidden: ReadonlySet<string>): Occurrence[] {
  const out: Occurrence[] = []
  for (const ev of plan.events) {
    if (hidden.has(ev.calendar)) continue
    const s = parseLocal(ev.start)
    const e = parseLocal(ev.end)
    if (ev.rrule) {
      const days = new Set((ev.rrule.match(/BYDAY=([A-Z,]+)/)?.[1] ?? '').split(',').map((d) => BYDAY[d]))
      const duration = e - s
      const timeOfDay = s - startOfDay(s)
      for (let d = Math.max(startOfDay(from), startOfDay(s)); d < to; d += DAY) {
        if (days.has(weekday(d))) out.push({ ...ev, s: d + timeOfDay, e: d + timeOfDay + duration })
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

export const durationHours = (o: Occurrence) => (o.e - o.s) / HOUR

/** Study time that counts toward the weekly budget: busy, timed, not personal. */
export const countsToBudget = (o: Occurrence) => !o.allDay && o.availability !== 'free' && o.calendar !== 'personal'

export const planStart = (plan: Plan) =>
  parseLocal(plan.events.reduce((min, e) => (e.start < min ? e.start : min), '9999-12-31'))
