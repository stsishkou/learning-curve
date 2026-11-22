import { DAY, parseLocal, startOfDay } from './dates'
import { isSession, plannedHours, spentHours } from './progress'
import type { Plan, PlanEvent } from './types'

/** A module of a course: the sessions that share a title once the `(2/3)` counter is taken off. */
export interface ModuleGoal {
  calendar: string
  /** The module's title without the course name and the counter */
  title: string
  sessions: number
  done: number
  /** Day of the module's last session, wall-clock ms: the goal belongs to the week and the month of that day */
  finish: number
}

/** What a month asks of one course. */
export interface CourseGoal {
  calendar: string
  modules: number
  doneModules: number
  /** The course's last session is in this month */
  completes: boolean
}

export interface WeekReview {
  /** Hours of the week's sessions: planned, marked done (as planned) and really spent on the done ones */
  planned: number
  done: number
  spent: number
  sessions: number
  doneSessions: number
  /** Sessions of the week that are over and not done */
  missed: number
  goals: ModuleGoal[]
}

const COUNTER = / \(\d+\/\d+\)$/
const moduleOf = (e: PlanEvent) => e.title.replace(COUNTER, '')

/** Every module of the plan, in the order its last session comes. */
export function moduleGoals(plan: Plan): ModuleGoal[] {
  const goals = new Map<string, ModuleGoal>()
  for (const e of plan.events) {
    if (!isSession(e)) continue
    const key = `${e.calendar}\n${moduleOf(e)}`
    const goal = goals.get(key) ?? {
      calendar: e.calendar,
      title: moduleOf(e).replace(/^[^—]+— /, ''),
      sessions: 0,
      done: 0,
      finish: 0,
    }
    goal.sessions += 1
    if (e.done) goal.done += 1
    goal.finish = Math.max(goal.finish, startOfDay(parseLocal(e.start)))
    goals.set(key, goal)
  }
  return [...goals.values()].toSorted((a, b) => a.finish - b.finish)
}

/** The modules to finish from `from` up to `to` (wall-clock ms): the ones whose last session falls there. */
export const goalsBetween = (plan: Plan, from: number, to: number): ModuleGoal[] =>
  moduleGoals(plan).filter((goal) => goal.finish >= from && goal.finish < to)

/** The month's goals course by course, in calendar order. */
export function monthGoals(plan: Plan, from: number, to: number): CourseGoal[] {
  const all = moduleGoals(plan)
  return plan.calendars.flatMap((calendar) => {
    const mine = all.filter((goal) => goal.calendar === calendar.id)
    const due = mine.filter((goal) => goal.finish >= from && goal.finish < to)
    if (!due.length) return []
    return [
      {
        calendar: calendar.id,
        modules: due.length,
        doneModules: due.filter((goal) => goal.done === goal.sessions).length,
        completes: mine.at(-1) === due.at(-1),
      },
    ]
  })
}

/** How the week starting on `monday` went, as far as `now` (both wall-clock ms). */
export function weekReview(plan: Plan, monday: number, now: number): WeekReview {
  const end = monday + 7 * DAY
  const review: WeekReview = {
    planned: 0,
    done: 0,
    spent: 0,
    sessions: 0,
    doneSessions: 0,
    missed: 0,
    goals: goalsBetween(plan, monday, end),
  }
  for (const e of plan.events) {
    const start = parseLocal(e.start)
    if (!isSession(e) || start < monday || start >= end) continue
    review.sessions += 1
    review.planned += plannedHours(e)
    if (e.done) {
      review.doneSessions += 1
      review.done += plannedHours(e)
      review.spent += spentHours(e)
    } else if (parseLocal(e.end) <= now) {
      review.missed += 1
    }
  }
  return review
}
