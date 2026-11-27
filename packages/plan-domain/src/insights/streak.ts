import { DAY, mondayOf, parseLocal, startOfDay } from '../core/dates'
import { planStart } from '../core/occurrences'
import { isDone, isSession, plannedHours } from '../core/progress'
import type { Plan } from '../core/types'

export interface StudyDay {
  /** Start of the day, Minsk wall-clock ms */
  day: number
  /** Hours of sessions planned for the day, and how many of them are marked done */
  planned: number
  done: number
}

export interface StudyStreak {
  /** Study days in a row with something done, up to today */
  current: number
  best: number
  /** Every day from the Monday of the plan's first week to the Sunday of its last */
  days: StudyDay[]
}

/**
 * The habit behind the plan: on how many study days in a row something was done. A day with no session planned
 * does not break the run, and neither does today while its sessions are still open.
 */
export function studyStreak(plan: Plan, now: number): StudyStreak {
  const first = mondayOf(planStart(plan))
  const last = mondayOf(parseLocal(plan.meta.planEnd)) + 7 * DAY
  const byDay = new Map<number, StudyDay>()
  for (let day = first; day < last; day += DAY) byDay.set(day, { day, planned: 0, done: 0 })
  for (const event of plan.events) {
    const entry = isSession(event) ? byDay.get(startOfDay(parseLocal(event.start))) : undefined
    if (!entry) continue
    entry.planned += plannedHours(event)
    if (isDone(event)) entry.done += plannedHours(event)
  }
  const days = [...byDay.values()]
  const today = startOfDay(now)
  let current = 0
  let best = 0
  for (const { day, planned, done } of days) {
    if (day > today || planned === 0 || (day === today && done === 0)) continue
    current = done > 0 ? current + 1 : 0
    best = Math.max(best, current)
  }
  return { current, best, days }
}
