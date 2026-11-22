import { parseLocal } from './dates'
import type { Plan, PlanEvent } from './types'

/** Fields of an event that can be changed in the viewer. Times are Europe/Minsk wall-clock strings. */
export type EventPatch = Partial<Pick<PlanEvent, 'title' | 'description' | 'start' | 'end'>>

/** Manual changes kept in `src/data/edits.json` and applied on top of the generated schedule. */
export interface PlanEdits {
  version: 1
  /** Patches by event uid */
  events: Record<string, EventPatch>
}

export const emptyEdits = (): PlanEdits => ({ version: 1, events: {} })

const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** Reads a patch from untrusted input; returns null when a field has the wrong type or format. */
export function parsePatch(value: unknown): EventPatch | null {
  if (!isRecord(value)) return null
  const patch: EventPatch = {}
  for (const key of ['title', 'description', 'start', 'end'] as const) {
    const field = value[key]
    if (field === undefined) continue
    if (typeof field !== 'string') return null
    if ((key === 'start' || key === 'end') && !LOCAL_TIME.test(field)) return null
    if (key === 'title' && !field.trim()) return null
    patch[key] = key === 'title' ? field.trim() : field
  }
  return patch
}

export function parseEdits(value: unknown): PlanEdits {
  const edits = emptyEdits()
  if (!isRecord(value) || !isRecord(value.events)) return edits
  for (const [uid, raw] of Object.entries(value.events)) {
    const patch = parsePatch(raw)
    if (patch && Object.keys(patch).length) edits.events[uid] = patch
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

/** The plan with every patch applied. Patches for unknown uids are returned in `orphans` and left out. */
export function applyEdits(plan: Plan, edits: PlanEdits): { plan: Plan; orphans: string[] } {
  const known = new Set(plan.events.map((e) => e.uid))
  const orphans = Object.keys(edits.events).filter((uid) => !known.has(uid))
  const events = plan.events
    .map((event) => {
      const patch = edits.events[event.uid]
      return patch && !patchProblem(event, patch) ? { ...event, ...patch } : event
    })
    .toSorted((a, b) => a.start.localeCompare(b.start) || a.calendar.localeCompare(b.calendar))

  // An event moved past the generated end must still be inside the range the list view shows.
  const lastDay = events.reduce(
    (max, e) => (e.uid in edits.events && !e.rrule && e.start.slice(0, 10) > max ? e.start.slice(0, 10) : max),
    plan.meta.planEnd,
  )
  return { plan: { ...plan, meta: { ...plan.meta, planEnd: lastDay }, events }, orphans }
}
