import type { SessionMove } from '../core/types'

/** Sessions per study day the dialog offers */
export const RHYTHMS = [1 / 3, 1 / 2, 1, 3 / 2, 2, 3] as const

/** `rhythm`: sessions per study day, one of `RHYTHMS`; `deadline`: finish before the calendar's deadline */
export type RebalanceTarget = { mode: 'rhythm'; perDay: number } | { mode: 'deadline' }

export interface RebalanceRequest {
  calendar: string
  /** First day that may change, YYYY-MM-DD */
  from: string
  /** The deadline typed in the dialog, YYYY-MM-DD; absent: the calendar's own deadline, if any */
  deadline?: string | undefined
  target: RebalanceTarget
  /** Weeks may go over the weekly budget; otherwise the budget is hard */
  overBudget: boolean
  /** Study hours of a day, `HH:MM`: sessions are placed only inside */
  hours: { from: string; to: string }
}

/** A binding fact behind the result, for the report to put in plain words */
export type RebalanceReason =
  | { kind: 'nothing-to-move' }
  | { kind: 'full-weeks'; from: string; to: string }
  | { kind: 'days-off'; days: string[] }
  | { kind: 'late'; placed: number; total: number; deadline: string }
  | { kind: 'no-lab-block'; title: string }
  | { kind: 'limit' }
  | { kind: 'not-proven'; gap: number }

export interface RebalanceReport {
  /** Day of the last session after the re-balance, and before it */
  finish: string | null
  finishBefore: string | null
  deadline: string | null
  /** Hours of the heaviest week (all study) and of the calendar's heaviest day */
  peakWeek: number
  peakDay: number
  overWeeks: { week: string; hours: number }[]
  moved: number
  late: number
  unplaced: number
  provenBest: boolean
  reasons: RebalanceReason[]
}

export interface RebalanceResult {
  /** Only the sessions whose slot changes */
  moves: SessionMove[]
  report: RebalanceReport
}
