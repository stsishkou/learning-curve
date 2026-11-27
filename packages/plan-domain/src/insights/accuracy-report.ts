import { MIN_LOGGED, accuracyOf, type Accuracy, type RatioSummary } from '../core/accuracy'
import { ymd } from '../core/dates'
import { courseProgress, isSession } from '../core/progress'
import type { EventKind, Plan, PlanEvent } from '../core/types'
import { finishRange, paceForecast, type FinishRange } from './forecast'

/** How far the logged times of some sessions are from their plan. */
export interface AccuracyNumbers {
  /** Sessions marked done, those with a logged time, and those without one: these count in no ratio */
  done: number
  logged: number
  unlogged: number
  /** Real ÷ planned hours of the logged sessions, what a forecast multiplies by; null below `minLogged` */
  pace: number | null
  /** Geometric mean of real ÷ planned per logged session, with its 95% interval; null below `minLogged` */
  typical: RatioSummary | null
}

export interface KindAccuracy extends AccuracyNumbers {
  kind: EventKind
}

export interface CourseAccuracy extends AccuracyNumbers {
  calendar: string
  name: string
  /** Each kind of session in the course: the reference class of a new session of that kind */
  kinds: KindAccuracy[]
  /** Planned hours of the sessions not done */
  hoursLeft: number
  /** Days, YYYY-MM-DD: the last planned session, and when the rest runs out at the course's pace; null when none is left */
  plannedFinish: string | null
  forecastFinish: string | null
  /** Days by which half and nine in ten of the simulated futures are done; null while nothing is logged to draw from */
  range: { likely: string; late: string; scope: FinishRange['scope'] } | null
}

/** What the logged times say about the plan, as a chat or a tool reads it. */
export interface AccuracyReport {
  /** The day the report was made, YYYY-MM-DD */
  today: string
  /** Logged sessions a group needs before it has a pace and a typical session */
  minLogged: number
  courses: CourseAccuracy[]
  /** Each kind of session in every course: the reference class while a course has too few of that kind */
  kinds: KindAccuracy[]
}

const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places

function numbers(accuracy: Accuracy): AccuracyNumbers {
  const { typical } = accuracy
  return {
    done: accuracy.done,
    logged: accuracy.logged,
    unlogged: accuracy.done - accuracy.logged,
    pace: accuracy.pace === null ? null : round(accuracy.pace),
    typical: typical && { ratio: round(typical.ratio), low: round(typical.low), high: round(typical.high) },
  }
}

const byKind = (sessions: readonly PlanEvent[]): KindAccuracy[] =>
  [...new Set(sessions.map((e) => e.kind))].map((kind) => ({
    kind,
    ...numbers(accuracyOf(sessions.filter((e) => e.kind === kind))),
  }))

/**
 * The numbers the planner shows about estimates, for a chat or a tool: per course and per kind of session the counts
 * and the ratios a length is judged by, and when each course will finish. `calendar` narrows the courses; the kinds
 * stay those of every course, the fallback reference class (docs/estimate-accuracy-research.md, 5.2).
 */
export function accuracyReport(plan: Plan, now: number, calendar?: string): AccuracyReport {
  const sessions = plan.events.filter(isSession)
  return {
    today: ymd(now),
    minLogged: MIN_LOGGED,
    courses: courseProgress(plan)
      .filter((course) => !calendar || course.calendar.id === calendar)
      .map((course) => {
        const id = course.calendar.id
        const forecast = paceForecast(plan, now, id)
        const range = finishRange(plan, now, { calendar: id })
        return {
          calendar: id,
          name: course.calendar.name,
          ...numbers(course.accuracy),
          kinds: byKind(sessions.filter((e) => e.calendar === id)),
          hoursLeft: round(forecast.remaining, 1),
          plannedFinish: forecast.planned === null ? null : ymd(forecast.planned),
          forecastFinish: forecast.finish === null ? null : ymd(forecast.finish),
          range: range && { likely: ymd(range.likely), late: ymd(range.late), scope: range.scope },
        }
      }),
    kinds: byKind(sessions),
  }
}
