import { parseLocal } from './dates'
import type { Plan, PlanCalendar, PlanEvent } from './types'

/** Fields of an event that can be changed in the viewer. Times are Europe/Minsk wall-clock strings. */
export type EventPatch = Partial<Pick<PlanEvent, 'title' | 'description' | 'start' | 'end' | 'calendar' | 'done'>>

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
}

export const emptyEdits = (): PlanEdits => ({ version: 1, events: {}, calendars: {}, added: [] })

export const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
export const HEX_COLOR = /^#[0-9a-f]{6}$/i
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

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
  if (value.done !== undefined) {
    if (typeof value.done !== 'boolean') return null
    patch.done = value.done
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
  const event: PlanEvent = {
    uid: value.uid,
    calendar,
    title,
    start,
    end,
    description: patch.description ?? '',
    kind: value.availability === 'free' ? 'personal' : 'study',
    availability: value.availability === 'free' ? 'free' : 'busy',
  }
  if (patch.done) event.done = true
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

  const events = [
    ...plan.events.map((event) => {
      const patch = edits.events[event.uid]
      if (!patch || patchProblem(event, patch)) return event
      const next = { ...event, ...patch }
      if (!next.done) delete next.done
      return calendarIds.has(next.calendar) ? next : { ...next, calendar: event.calendar }
    }),
    ...edits.added.filter((event) => calendarIds.has(event.calendar) && !known.has(event.uid)),
  ].toSorted((a, b) => a.start.localeCompare(b.start) || a.calendar.localeCompare(b.calendar))

  // An event moved or added past the generated end must still be inside the range the list view shows.
  const touched = new Set([...Object.keys(edits.events), ...edits.added.map((e) => e.uid)])
  const lastDay = events.reduce(
    (max, e) => (touched.has(e.uid) && !e.rrule && e.start.slice(0, 10) > max ? e.start.slice(0, 10) : max),
    plan.meta.planEnd,
  )
  return { plan: { ...plan, meta: { ...plan.meta, planEnd: lastDay }, calendars, events }, orphans }
}
