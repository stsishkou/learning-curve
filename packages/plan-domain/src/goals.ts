import { accuracyOf, type Accuracy } from './accuracy'
import { isCustomEvent } from './changes'
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
  /** What the time logged this week says, with the counts it rests on */
  accuracy: Accuracy
}

const COUNTER = / \(\d+\/\d+\)$/
const moduleOf = (e: PlanEvent) => e.title.replace(COUNTER, '')

/** Every module of the plan, in the order its last session comes. */
export function moduleGoals(plan: Plan): ModuleGoal[] {
  const goals = new Map<string, ModuleGoal>()
  for (const e of plan.events) {
    // A review goes back to a module that is already counted.
    if (!isSession(e) || e.kind === 'review') continue
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

/** How the hours logged on a module compare with the hours it was planned with. */
export interface ModuleOverrun {
  calendar: string
  /** The module's title without the course name and the counter */
  title: string
  /** Its sessions now, split parts and added ones included, how many of them are done and how many have a time */
  sessions: number
  done: number
  logged: number
  /** Hours the module was planned with: the sessions it was created with, each at its first length */
  planned: number
  /** Hours logged on its done sessions */
  spent: number
  /** `spent ÷ planned` once every session is done with a logged time and the last one met its goal; null before */
  ratio: number | null
  /** Sessions added to it after it was planned: the work the plan did not foresee */
  added: number
  /** Done sessions whose time ran out before their goal */
  unfinished: number
}

/**
 * Every module with a done session, from the longest overrun down, then those still without a ratio. The module, not
 * the session, is what the content estimated: a session can end on time with its goal unmet and the rest done in an
 * added one, which only the module's total shows (docs/estimate-accuracy-research.md, 5.3).
 */
export function moduleOverruns(plan: Plan): ModuleOverrun[] {
  const modules = new Map<string, PlanEvent[]>()
  for (const e of plan.events) {
    if (!isSession(e) || e.kind === 'review') continue
    const key = `${e.calendar}\n${moduleOf(e)}`
    modules.set(key, [...(modules.get(key) ?? []), e])
  }
  const rows = [...modules.values()].flatMap((sessions): ModuleOverrun[] => {
    const [first] = sessions
    const done = sessions.filter((e) => e.done)
    if (!first || !done.length) return []
    // In a course made in the viewer every session is added; only one added to a generated module is extra work.
    const generated = sessions.some((e) => !isCustomEvent(e))
    const isAdded = (e: PlanEvent) => generated && isCustomEvent(e) && e.from === undefined
    // A split part's hours are already in the first length of the session it came from.
    const planned = sessions
      .filter((e) => e.from === undefined && !isAdded(e))
      .reduce((sum, e) => sum + (e.estimate === undefined ? plannedHours(e) : e.estimate / 60), 0)
    const logged = done.filter((e) => e.actual !== undefined)
    const spent = logged.reduce((sum, e) => sum + (e.actual ?? 0) / 60, 0)
    const last = sessions.toSorted((a, b) => a.start.localeCompare(b.start)).at(-1)
    const complete = logged.length === sessions.length && !last?.unfinished && planned > 0
    return [
      {
        calendar: first.calendar,
        title: moduleOf(first).replace(/^[^—]+— /, ''),
        sessions: sessions.length,
        done: done.length,
        logged: logged.length,
        planned,
        spent,
        ratio: complete ? spent / planned : null,
        added: sessions.filter(isAdded).length,
        unfinished: done.filter((e) => e.unfinished).length,
      },
    ]
  })
  return rows.toSorted((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1))
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
  const week = plan.events.filter((e) => {
    const start = parseLocal(e.start)
    return isSession(e) && start >= monday && start < end
  })
  const review: WeekReview = {
    planned: 0,
    done: 0,
    spent: 0,
    sessions: 0,
    doneSessions: 0,
    missed: 0,
    goals: goalsBetween(plan, monday, end),
    accuracy: accuracyOf(week),
  }
  for (const e of week) {
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
