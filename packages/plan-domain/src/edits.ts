import { parseLocal } from './dates'
import { WEEKLY_RULE } from './recurrence'
import type { Plan, PlanCalendar, PlanEvent } from './types'

/** Fields of an event that can be changed in the viewer. Times are Europe/Minsk wall-clock strings. */
export type EventPatch = Partial<
  Pick<
    PlanEvent,
    | 'title'
    | 'description'
    | 'start'
    | 'end'
    | 'calendar'
    | 'done'
    | 'actual'
    | 'measured'
    | 'began'
    | 'paused'
    | 'unfinished'
    | 'estimate'
    | 'from'
    | 'paced'
    | 'rrule'
    | 'skip'
  >
>

/** What the stopwatch records with a time it measured. Only `session.finish` writes it; a patch never may. */
export const STOPWATCH_FIELDS = ['measured', 'began', 'paused'] as const

/** What the app keeps about where a session came from: its first planned length and the session it was split from. */
export const ORIGIN_FIELDS = ['estimate', 'from'] as const

/** `fields` without the stopwatch's record: a time set any other way was not measured. */
export const withoutRecord = <T extends EventPatch>({
  measured: _measured,
  began: _began,
  paused: _paused,
  ...rest
}: T) => rest

/** Drops what only a done session has: its logged time, the stopwatch's record and the unfinished mark. */
export function forgetFinish(fields: EventPatch) {
  delete fields.actual
  delete fields.measured
  delete fields.began
  delete fields.paused
  delete fields.unfinished
}

/** A calendar's look. For a generated calendar it overrides the content; an unknown id adds a calendar. */
export type CalendarPatch = Pick<PlanCalendar, 'name' | 'color'>

/** Manual changes kept in `packages/plan-data/data/edits.json` and applied on top of the generated schedule. */
export interface PlanEdits {
  version: 1
  /** Patches by event uid */
  events: Record<string, EventPatch>
  /** Renamed, recolored and added calendars by id */
  calendars: Record<string, CalendarPatch>
  /** Events created in the viewer */
  added: PlanEvent[]
  /**
   * The trash, by event uid and calendar id: when each was removed (an ISO instant), or `null` once the time to
   * restore it has passed. A removed calendar hides its events too.
   */
  removed: { events: Record<string, string | null>; calendars: Record<string, string | null> }
  /** The plan's own name, when it was changed in the viewer */
  title?: string
  /** The calendar whose deadline the countdown follows, when one was chosen in the viewer */
  countdown?: string
}

export const emptyEdits = (): PlanEdits => ({
  version: 1,
  events: {},
  calendars: {},
  added: [],
  removed: { events: {}, calendars: {} },
})

/** Longest plan title that is kept */
export const TITLE_MAX = 80
const DATE = /^\d{4}-\d{2}-\d{2}$/
export const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
export const HEX_COLOR = /^#[0-9a-f]{6}$/i
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** `record` without `key`; the other keys stay in their order. */
export const without = <T>(record: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([name]) => name !== key))

/** An event's length in minutes */
const lengthOf = (event: Pick<PlanEvent, 'start' | 'end'>) => (parseLocal(event.end) - parseLocal(event.start)) / 60_000

/** Whole minutes from `least` to a day */
const minutes = (field: unknown, least: number): field is number =>
  typeof field === 'number' && Number.isInteger(field) && field >= least && field <= 24 * 60

/** Reads a patch from untrusted input; returns null when a field has the wrong type or format. */
export function parsePatch(value: unknown): EventPatch | null {
  if (!isRecord(value)) return null
  const patch: EventPatch = {}
  for (const key of ['title', 'description', 'start', 'end', 'calendar'] as const) {
    const field = value[key]
    if (field === undefined) continue
    if (typeof field !== 'string') return null
    if ((key === 'start' || key === 'end') && !LOCAL_TIME.test(field)) return null
    if ((key === 'title' || key === 'calendar') && !field.trim()) return null
    patch[key] = key === 'title' ? field.trim() : field
  }
  for (const key of ['done', 'unfinished'] as const) {
    const field = value[key]
    if (field === undefined) continue
    if (typeof field !== 'boolean') return null
    patch[key] = field
  }
  if (value.paced !== undefined) {
    if (value.paced !== true) return null
    patch.paced = true
  }
  if (value.actual !== undefined) {
    if (!minutes(value.actual, 5)) return null
    patch.actual = value.actual
  }
  if (value.measured !== undefined) {
    if (value.measured !== true) return null
    patch.measured = true
  }
  if (value.began !== undefined) {
    if (typeof value.began !== 'string' || !LOCAL_TIME.test(value.began)) return null
    patch.began = value.began
  }
  if (value.paused !== undefined) {
    if (!minutes(value.paused, 0)) return null
    patch.paused = value.paused
  }
  if (value.estimate !== undefined) {
    if (!minutes(value.estimate, 1)) return null
    patch.estimate = value.estimate
  }
  if (value.from !== undefined) {
    if (typeof value.from !== 'string' || !value.from) return null
    patch.from = value.from
  }
  if (value.rrule !== undefined) {
    if (typeof value.rrule !== 'string' || !WEEKLY_RULE.test(value.rrule) || !value.rrule.includes('BYDAY=')) {
      return null
    }
    patch.rrule = value.rrule
  }
  if (value.skip !== undefined) {
    if (!Array.isArray(value.skip)) return null
    const days = value.skip.filter((day): day is string => typeof day === 'string' && DATE.test(day))
    if (days.length !== value.skip.length) return null
    patch.skip = [...new Set(days)].toSorted()
  }
  return patch
}

export function parseCalendarPatch(value: unknown): CalendarPatch | null {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.color !== 'string') return null
  if (!value.name.trim() || !HEX_COLOR.test(value.color)) return null
  return { name: value.name.trim(), color: value.color }
}

/** Reads an event created in the viewer; returns null when it is not a complete, well-formed event. */
export function parseAddedEvent(value: unknown): PlanEvent | null {
  const patch = parsePatch(value)
  if (!isRecord(value) || !patch || typeof value.uid !== 'string' || !value.uid) return null
  const { title, start, end, calendar } = patch
  if (!title || !start || !end || !calendar) return null
  if (value.kind === 'milestone') {
    const milestone: PlanEvent = {
      uid: value.uid,
      calendar,
      title,
      start,
      end,
      description: patch.description ?? '',
      kind: 'milestone',
      availability: 'free',
      allDay: true,
    }
    return patchProblem(milestone, {}) ? null : milestone
  }
  const event: PlanEvent = {
    uid: value.uid,
    calendar,
    title,
    start,
    end,
    description: patch.description ?? '',
    // A repeat moved out of a personal series stays personal: it is not a study session.
    kind:
      value.availability === 'free' || value.kind === 'personal'
        ? 'personal'
        : value.kind === 'review' || value.kind === 'lab'
          ? value.kind
          : 'study',
    availability: value.availability === 'free' ? 'free' : 'busy',
  }
  if (patch.done) event.done = true
  if (patch.done && patch.actual) {
    event.actual = patch.actual
    if (patch.measured) event.measured = true
    if (patch.began) event.began = patch.began
    if (patch.paused) event.paused = patch.paused
  }
  if (patch.done && patch.unfinished) event.unfinished = true
  if (patch.estimate) event.estimate = patch.estimate
  if (patch.from) event.from = patch.from
  if (patch.paced) event.paced = true
  if (patch.rrule) event.rrule = patch.rrule
  if (patch.rrule && patch.skip?.length) event.skip = patch.skip
  return patchProblem(event, {}) ? null : event
}

export function parseEdits(value: unknown): PlanEdits {
  const edits = emptyEdits()
  if (!isRecord(value)) return edits
  if (isRecord(value.events)) {
    for (const [uid, raw] of Object.entries(value.events)) {
      const patch = parsePatch(raw)
      if (patch && Object.keys(patch).length) edits.events[uid] = patch
    }
  }
  if (isRecord(value.calendars)) {
    for (const [id, raw] of Object.entries(value.calendars)) {
      const patch = parseCalendarPatch(raw)
      if (patch) edits.calendars[id] = patch
    }
  }
  if (Array.isArray(value.added)) {
    for (const raw of value.added) {
      const event = parseAddedEvent(raw)
      if (event) edits.added.push(event)
    }
  }
  if (isRecord(value.removed)) {
    for (const key of ['events', 'calendars'] as const) {
      const marks = value.removed[key]
      if (!isRecord(marks)) continue
      for (const [id, at] of Object.entries(marks)) {
        if (at === null || (typeof at === 'string' && !Number.isNaN(Date.parse(at)))) edits.removed[key][id] = at
      }
    }
  }
  if (typeof value.title === 'string' && value.title.trim()) edits.title = value.title.trim().slice(0, TITLE_MAX)
  if (typeof value.countdown === 'string' && value.countdown) edits.countdown = value.countdown
  return edits
}

/** Why a patched event cannot be saved, or null when it is fine. */
export function patchProblem(event: PlanEvent, patch: EventPatch): 'order' | null {
  const merged = { ...event, ...patch }
  const start = parseLocal(merged.start)
  const end = parseLocal(merged.end)
  if (Number.isNaN(start) || Number.isNaN(end)) return 'order'
  if (event.allDay ? end < start : end <= start) return 'order'
  return null
}

/** The plan with every edit applied. Patches for unknown uids are returned in `orphans` and left out. */
export function applyEdits(plan: Plan, edits: PlanEdits): { plan: Plan; orphans: string[] } {
  const known = new Set(plan.events.map((e) => e.uid))
  const orphans = Object.keys(edits.events).filter((uid) => !known.has(uid))

  const generatedIds = new Set(plan.calendars.map((c) => c.id))
  const calendars: PlanCalendar[] = [
    ...plan.calendars.map((c) => ({ ...c, ...edits.calendars[c.id] })),
    ...Object.entries(edits.calendars)
      .filter(([id]) => !generatedIds.has(id))
      .map(([id, patch]) => ({ id, ...patch, isNew: true, custom: true })),
  ]
  const calendarIds = new Set(calendars.map((c) => c.id))
  const gone = edits.removed

  const events = [
    ...plan.events.map((event) => {
      const patch = edits.events[event.uid]
      if (!patch || patchProblem(event, patch)) return event
      const next = { ...event, ...patch }
      delete next.from
      // A generated session's first length is the one it is generated with.
      const planned = lengthOf(event)
      if (lengthOf(next) === planned) delete next.estimate
      else next.estimate = planned
      if (!next.done) {
        delete next.done
        forgetFinish(next)
      }
      if (!next.unfinished) delete next.unfinished
      if (!next.skip?.length) delete next.skip
      return calendarIds.has(next.calendar) ? next : { ...next, calendar: event.calendar }
    }),
    ...edits.added.filter((event) => calendarIds.has(event.calendar) && !known.has(event.uid)),
  ]
    .filter((event) => !(event.uid in gone.events) && !(event.calendar in gone.calendars))
    .toSorted((a, b) => a.start.localeCompare(b.start) || a.calendar.localeCompare(b.calendar))

  // An event moved or added past the generated end must still be inside the range the list view shows.
  const touched = new Set([...Object.keys(edits.events), ...edits.added.map((e) => e.uid)])
  const lastDay = events.reduce(
    (max, e) => (touched.has(e.uid) && !e.rrule && e.start.slice(0, 10) > max ? e.start.slice(0, 10) : max),
    plan.meta.planEnd,
  )
  const shown = calendars.filter((c) => !(c.id in gone.calendars))
  const meta = {
    ...plan.meta,
    planEnd: lastDay,
    title: edits.title ?? plan.meta.title,
    ...(edits.countdown ? { countdown: edits.countdown } : {}),
  }
  return { plan: { ...plan, meta, calendars: shown, events }, orphans }
}
