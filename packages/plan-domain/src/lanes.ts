import { DAY, mondayOf, parseLocal, startOfDay, ymd } from './dates'
import { deadlineOf } from './deadlines'
import type { PlanDiff } from './diff'
import { isSession } from './progress'
import type { Plan, PlanCalendar } from './types'

export type LaneSessionState = 'done' | 'open' | 'missed'

export interface LaneSession {
  uid: string
  /** `YYYY-MM-DD` */
  day: string
  state: LaneSessionState
}

/** One calendar on the timeline: its span of sessions, their state and its deadline. Days are `YYYY-MM-DD`. */
export interface CalendarLane {
  calendar: PlanCalendar
  first: string
  last: string
  deadline: string | null
  /** In the order they start */
  sessions: LaneSession[]
  done: number
  total: number
  /** The day of the first session that is not done; null when all are done */
  openFrom: string | null
}

const MIN_DAYS = 28
// Room after the latest end or deadline, so that it too can be dragged later.
const ROOM_DAYS = 14

/**
 * A lane for every shown calendar that has sessions and still has something ahead: a session not done, or a deadline
 * from today on. Before the clock is known (`now` null) nothing counts as missed and every deadline is ahead.
 */
export function calendarLanes(plan: Plan, now: number | null, hidden: ReadonlySet<string>): CalendarLane[] {
  const today = now === null ? '' : ymd(now)
  return plan.calendars.flatMap((calendar) => {
    if (hidden.has(calendar.id)) return []
    const events = plan.events
      .filter((e) => e.calendar === calendar.id && isSession(e))
      .toSorted((a, b) => a.start.localeCompare(b.start))
    const [head] = events
    const tail = events.at(-1)
    if (!head || !tail) return []
    const deadline = deadlineOf(plan, calendar.id)
    const open = events.find((e) => !e.done)
    if (!open && (deadline === null || deadline < today)) return []
    const sessions = events.map((e): LaneSession => ({
      uid: e.uid,
      day: e.start.slice(0, 10),
      state: e.skipped ? 'missed' : e.done ? 'done' : now !== null && parseLocal(e.end) <= now ? 'missed' : 'open',
    }))
    return [
      {
        calendar,
        first: head.start.slice(0, 10),
        last: tail.start.slice(0, 10),
        deadline,
        sessions,
        done: sessions.filter((s) => s.state === 'done').length,
        total: sessions.length,
        openFrom: open ? open.start.slice(0, 10) : null,
      },
    ]
  })
}

const dayOf = (day: string) => parseLocal(day)

/**
 * The days the timeline draws, as day ms with `end` excluded: from the Monday of the week before today, or of an
 * earlier deadline still on a lane, to two weeks after the last session or deadline, at least four weeks. Before the
 * clock is known, the first open session stands in for today. null when there are no lanes.
 */
export function lanesRange(lanes: CalendarLane[], now: number | null): { start: number; end: number } | null {
  if (!lanes.length) return null
  const anchors = lanes.map((lane) => lane.openFrom).filter((day) => day !== null)
  const anchor = now ?? Math.min(...(anchors.length ? anchors : lanes.map((lane) => lane.first)).map(dayOf))
  const deadlines = lanes
    .map((lane) => lane.deadline)
    .filter((day) => day !== null)
    .map(dayOf)
  const start = Math.min(mondayOf(startOfDay(anchor)) - 7 * DAY, ...deadlines.map(mondayOf))
  const latest = Math.max(...lanes.map((lane) => dayOf(lane.last)), ...deadlines) + DAY
  return { start, end: Math.max(latest + ROOM_DAYS * DAY, start + MIN_DAYS * DAY) }
}

const daysBetween = (a: string, b: string) => Math.round((dayOf(b) - dayOf(a)) / DAY)

/** Days from the day after the last session to the deadline: negative when the course ends after it; null without one. */
export function laneSpare(lane: CalendarLane): number | null {
  return lane.deadline === null ? null : daysBetween(lane.last, lane.deadline) - 1
}

// `events.shift` takes at most 366 days; whole weeks keep each session on its weekday.
const MAX_MOVE = 364

/**
 * How far, in whole weeks of days, the course's sessions from `today` on may move: back no further than today, forward
 * no further than one shift allows. Null when nothing from today on is left to move.
 */
export function laneMoveBounds(lane: CalendarLane, today: string): { min: number; max: number } | null {
  const first = lane.sessions.find((s) => s.state !== 'done' && s.day >= today)
  if (!first) return null
  const back = Math.min(MAX_MOVE, Math.floor(daysBetween(today, first.day) / 7) * 7)
  return { min: back === 0 ? 0 : -back, max: MAX_MOVE }
}

/** The sessions an update gives another time. */
export function movedSessions(diff: PlanDiff): Set<string> {
  return new Set(
    diff.changed
      .filter(({ before, after }) => isSession(after) && (before.start !== after.start || before.end !== after.end))
      .map(({ after }) => after.uid),
  )
}

/** A lane an update changes: as it was and as it would be. Day counts are positive when later. */
export interface LaneChange {
  calendar: string
  before: CalendarLane
  after: CalendarLane
  /** Sessions of the lane that get another time */
  moved: number
  startDays: number
  endDays: number
}

/** The lanes on both sides whose sessions, span or deadline differ, in the order of `after`. */
export function compareLanes(
  before: CalendarLane[],
  after: CalendarLane[],
  moved: ReadonlySet<string>,
): Map<string, LaneChange> {
  const was = new Map(before.map((lane) => [lane.calendar.id, lane]))
  const changed = new Map<string, LaneChange>()
  for (const lane of after) {
    const old = was.get(lane.calendar.id)
    if (!old) continue
    const change: LaneChange = {
      calendar: lane.calendar.id,
      before: old,
      after: lane,
      moved: lane.sessions.filter((session) => moved.has(session.uid)).length,
      startDays: daysBetween(old.first, lane.first),
      endDays: daysBetween(old.last, lane.last),
    }
    if (change.moved || change.startDays || change.endDays || old.deadline !== lane.deadline) {
      changed.set(lane.calendar.id, change)
    }
  }
  return changed
}
