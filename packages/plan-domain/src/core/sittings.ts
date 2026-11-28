import { isSession } from './progress'
import {
  doneMinutesOf,
  firstPlanOf,
  groupKey,
  groupState,
  isLinked,
  minutesOf,
  rootOf,
  type GroupState,
} from './sitting-state'
import type { Plan, PlanEvent } from './types'

const MINUTE = 60_000
const ROUND = 5 * MINUTE
/** The shortest rest worth booking, minutes */
const REST_MIN = 15

const byStart = (a: PlanEvent, b: PlanEvent) => a.start.localeCompare(b.start)

/** A planned session and the sittings that continue it, read from the plan. */
export interface SessionGroup {
  /** The root's uid, which every other sitting names in `from` */
  key: string
  /** From the root, or from the earliest sitting when the root is in the trash */
  calendar: string
  title: string
  /** In start order */
  sittings: PlanEvent[]
  /** Minutes the session was first planned with */
  firstPlan: number
  /** Minutes the done sittings took; a skipped one adds none */
  doneMinutes: number
  /** Minutes of the sittings not done, a missed one included */
  bookedMinutes: number
  state: GroupState
  /** The earliest sitting not done, past or future */
  next: PlanEvent | null
  /** Shown as linked: an ordinary session, never split nor continued, is not */
  linked: boolean
}

function groupFrom(key: string, sittings: PlanEvent[]): SessionGroup | null {
  const root = rootOf(sittings, key)
  if (!root) return null
  return {
    key,
    calendar: root.calendar,
    title: root.title,
    sittings,
    firstPlan: firstPlanOf(sittings, key),
    doneMinutes: sittings.reduce((sum, e) => sum + doneMinutesOf(e), 0),
    bookedMinutes: sittings.reduce((sum, e) => sum + (e.done ? 0 : minutesOf(e)), 0),
    state: groupState(sittings),
    next: sittings.find((e) => !e.done) ?? null,
    linked: isLinked(sittings),
  }
}

/** Every session's group, a session never split nor continued being a group of one. */
export function sittingGroups(plan: Plan): SessionGroup[] {
  const byKey = new Map<string, PlanEvent[]>()
  for (const e of plan.events.filter(isSession).toSorted(byStart)) {
    const sittings = byKey.get(groupKey(e))
    if (sittings) sittings.push(e)
    else byKey.set(groupKey(e), [e])
  }
  return [...byKey].flatMap(([key, sittings]) => groupFrom(key, sittings) ?? [])
}

/** The group of the sitting `uid`; null when it is not a session of the plan. */
export function groupOf(plan: Plan, uid: string): SessionGroup | null {
  const event = plan.events.find((e) => e.uid === uid)
  if (!event || !isSession(event)) return null
  const key = groupKey(event)
  return groupFrom(key, plan.events.filter((e) => isSession(e) && groupKey(e) === key).toSorted(byStart))
}

/** When a group was last worked on: the latest stopwatch start, or planned start, of its done sittings. */
const lastWorked = (group: SessionGroup) =>
  group.sittings.reduce((latest, e) => {
    const at = e.done ? (e.began ?? e.start) : ''
    return at > latest ? at : latest
  }, '')

/** The groups started but not done, outside the hidden calendars, the latest worked on first. */
export const openGroups = (plan: Plan, hidden: ReadonlySet<string>): SessionGroup[] =>
  sittingGroups(plan)
    .filter((g) => g.state === 'open' && !hidden.has(g.calendar))
    .toSorted((a, b) => lastWorked(b).localeCompare(lastWorked(a)))

/** A stretch of a group's bar: a done sitting, a booked one, or the part of the first plan not booked yet. */
export interface BarSegment {
  kind: 'done' | 'booked' | 'rest'
  minutes: number
  /** The sitting it stands for; null for the rest */
  uid: string | null
}

/** A group's bar, in minutes: its length, its stretches and where the first plan ends when the work passed it. */
export interface GroupBar {
  total: number
  segments: BarSegment[]
  tick: number | null
}

/** The bar of a group: what the done and booked sittings fill of the first plan, or how far past it they go. */
export function groupBar(group: SessionGroup): GroupBar {
  const done = group.sittings.flatMap((e): BarSegment[] => {
    const minutes = doneMinutesOf(e)
    return minutes > 0 ? [{ kind: 'done', minutes, uid: e.uid }] : []
  })
  const booked = group.sittings.flatMap((e): BarSegment[] =>
    e.done ? [] : [{ kind: 'booked', minutes: minutesOf(e), uid: e.uid }],
  )
  const work = group.doneMinutes + group.bookedMinutes
  const rest = group.firstPlan - work
  const unbooked: BarSegment[] = group.state === 'open' && rest > 0 ? [{ kind: 'rest', minutes: rest, uid: null }] : []
  return {
    total: Math.max(group.firstPlan, work),
    segments: [...done, ...booked, ...unbooked],
    tick: work > group.firstPlan ? group.firstPlan : null,
  }
}

/** How long a session will probably take: its plan times what sessions like it took, to five minutes. */
export const likelyLength = (planned: number, ratio: number) => Math.round((planned * ratio) / ROUND) * ROUND

/**
 * Minutes to book for the rest of a group: what is left of its likely length once the done and booked sittings are
 * taken off, to five minutes, and never less than `REST_MIN`. `ratio` is the course's typical ratio, or 1.
 */
export function restMinutes(group: SessionGroup, ratio: number): number {
  const left = likelyLength(group.firstPlan * MINUTE, ratio) / MINUTE - group.doneMinutes - group.bookedMinutes
  return Math.max(REST_MIN, Math.round(left / 5) * 5)
}

/** The sitting of group `key` that starts at `start` and is not done yet: the one just booked there. */
export const sittingAt = (plan: Plan, key: string, start: string): PlanEvent | null =>
  plan.events.find((e) => isSession(e) && groupKey(e) === key && e.start === start && !e.done) ?? null
