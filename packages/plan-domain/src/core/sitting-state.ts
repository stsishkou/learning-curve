import { parseLocal } from './dates'
import type { PlanEvent } from './types'

const MINUTE = 60_000

const minutesOf = (e: PlanEvent) => (parseLocal(e.end) - parseLocal(e.start)) / MINUTE

/** The group a sitting belongs to: the uid of the session it continues, or its own. */
export const groupKey = (e: PlanEvent): string => e.from ?? e.uid

/** Where a session spread over sittings stands: nothing done, started but not done, or done with its goal met. */
export type GroupState = 'planned' | 'open' | 'finished'

/** The state of a group from its sittings in start order. A skipped sitting counts as done. */
export function groupState(sittings: readonly PlanEvent[]): GroupState {
  const done = sittings.filter((e) => e.done)
  if (!done.length) return 'planned'
  return done.length === sittings.length && !done.at(-1)?.unfinished ? 'finished' : 'open'
}

/** Minutes the session was first planned with: the root's, or the earliest sitting's when the root is gone. */
export function firstPlanOf(sittings: readonly PlanEvent[], key: string): number {
  const root = sittings.find((e) => e.uid === key) ?? sittings.at(0)
  return root ? (root.estimate ?? minutesOf(root)) : 0
}

/** Shown as linked: two sittings or more, or one done and marked unfinished. */
export const isLinked = (sittings: readonly PlanEvent[]): boolean =>
  sittings.length > 1 || sittings.some((e) => e.done && e.unfinished)

/** Minutes a sitting adds to the work done: its logged time, or its plan; none when it is open or skipped. */
export const doneMinutesOf = (e: PlanEvent): number => (e.done && !e.skipped ? (e.actual ?? minutesOf(e)) : 0)
