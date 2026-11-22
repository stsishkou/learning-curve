import {
  HEX_COLOR,
  LOCAL_TIME,
  applyEdits,
  isRecord,
  parsePatch,
  patchProblem,
  type EventPatch,
  type PlanEdits,
} from './edits'
import { purgeTrash } from './trash'
import type { Plan, PlanEvent } from './types'

/** What a new event needs; the uid is assigned when the change is applied. */
export interface NewEvent {
  calendar: string
  title: string
  start: string
  end: string
  description: string
  /** `free` events do not count toward the weekly budget */
  availability: 'busy' | 'free'
}

/** One change a person makes to the plan in the viewer. The same value is applied in the browser and stored by the server. */
export type PlanChange =
  /** `null` drops the manual changes of a generated event */
  | { type: 'event.patch'; uid: string; patch: EventPatch | null }
  | { type: 'event.add'; event: NewEvent }
  /** Moves the event to the trash */
  | { type: 'event.remove'; uid: string }
  /** Without an id a new calendar is created */
  | { type: 'calendar.save'; id?: string; name: string; color: string }
  /** Moves the calendar and its events to the trash */
  | { type: 'calendar.remove'; id: string }
  /** Moves every event of the calendar to the trash and keeps the calendar */
  | { type: 'calendar.clear'; id: string }
  /** Brings back the listed events and calendars, or the whole trash when neither is given */
  | { type: 'trash.restore'; events?: string[]; calendars?: string[] }
  /** Removes everything in the trash for good */
  | { type: 'trash.empty' }

/** A change that cannot be applied; `message` is safe to show. */
export class PlanChangeError extends Error {}

const fail = (message: string): never => {
  throw new PlanChangeError(message)
}

/** Reads a change from untrusted input. Throws `PlanChangeError` when it is malformed. */
export function parseChange(input: unknown): PlanChange {
  if (!isRecord(input) || typeof input.type !== 'string') return fail('A change needs a type')
  const text = (key: string): string => {
    const value = input[key]
    return typeof value === 'string' && value.trim() ? value.trim() : fail(`${key} is required`)
  }
  switch (input.type) {
    case 'event.patch': {
      if (input.patch === null) return { type: 'event.patch', uid: text('uid'), patch: null }
      const patch = parsePatch(input.patch)
      return patch
        ? { type: 'event.patch', uid: text('uid'), patch }
        : fail('patch has a field of the wrong type or format')
    }
    case 'event.add': {
      const raw = input.event
      const patch = parsePatch(raw)
      if (!isRecord(raw) || !patch?.title || !patch.start || !patch.end || !patch.calendar) {
        return fail('A new event needs a title, a calendar, a start and an end')
      }
      return {
        type: 'event.add',
        event: {
          calendar: patch.calendar,
          title: patch.title,
          start: patch.start,
          end: patch.end,
          description: patch.description ?? '',
          availability: raw.availability === 'free' ? 'free' : 'busy',
        },
      }
    }
    case 'event.remove':
      return { type: 'event.remove', uid: text('uid') }
    case 'calendar.save': {
      const color = text('color')
      if (!HEX_COLOR.test(color)) return fail('color must look like #1a2b3c')
      const id = typeof input.id === 'string' && input.id ? input.id : undefined
      return { type: 'calendar.save', id, name: text('name'), color }
    }
    case 'calendar.remove':
      return { type: 'calendar.remove', id: text('id') }
    case 'calendar.clear':
      return { type: 'calendar.clear', id: text('id') }
    case 'trash.restore': {
      const ids = (key: string) => {
        const value = input[key]
        if (value === undefined) return undefined
        return Array.isArray(value) && value.every((id) => typeof id === 'string')
          ? value
          : fail(`${key} must be a list of ids`)
      }
      return { type: 'trash.restore', events: ids('events'), calendars: ids('calendars') }
    }
    case 'trash.empty':
      return { type: 'trash.empty' }
    default:
      return fail(`Unknown change "${input.type}"`)
  }
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * The edits after one change. `base` is the plan without any edits: the generated schedule, or an opened file.
 * Throws `PlanChangeError` when the change does not fit the plan.
 */
export function applyChange(base: Plan, edits: PlanEdits, change: PlanChange, now = Date.now()): PlanEdits {
  const next: PlanEdits = {
    version: 1,
    events: { ...edits.events },
    calendars: { ...edits.calendars },
    added: [...edits.added],
    removed: { events: { ...edits.removed.events }, calendars: { ...edits.removed.calendars } },
  }
  const { removed } = next
  const removedAt = new Date(now).toISOString()
  const calendarExists = (id: string) =>
    !(id in removed.calendars) && (id in next.calendars || base.calendars.some((c) => c.id === id))

  switch (change.type) {
    case 'event.patch': {
      const { uid, patch } = change
      if (patch?.calendar && !calendarExists(patch.calendar)) fail(`Unknown calendar "${patch.calendar}"`)
      const addedIndex = next.added.findIndex((e) => e.uid === uid)
      if (addedIndex !== -1) {
        if (!patch) return next
        const { rrule: _rule, skip: _skip, ...fields } = patch
        const merged: PlanEvent = { ...next.added[addedIndex], ...fields }
        if (!merged.done) delete merged.done
        if (patchProblem(merged, {})) fail('The event must end after it starts')
        next.added[addedIndex] = merged
        return next
      }
      const original = base.events.find((e) => e.uid === uid) ?? fail(`Unknown event "${uid}"`)
      if (!patch) {
        delete next.events[uid]
        return next
      }
      const merged: EventPatch = { ...next.events[uid], ...patch }
      // Keep only what differs from the original event, so the edits list real changes.
      for (const key of ['title', 'description', 'start', 'end', 'calendar', 'rrule'] as const) {
        if (merged[key] === original[key]) delete merged[key]
      }
      if (!merged.done === !original.done) delete merged.done
      if (!merged.skip?.length || !original.rrule) delete merged.skip
      if (!original.rrule) delete merged.rrule
      if (patchProblem(original, merged)) fail('The event must end after it starts')
      if (Object.keys(merged).length) next.events[uid] = merged
      else delete next.events[uid]
      break
    }
    case 'event.add': {
      const { event } = change
      if (!calendarExists(event.calendar)) fail(`Unknown calendar "${event.calendar}"`)
      if (!LOCAL_TIME.test(event.start) || !LOCAL_TIME.test(event.end)) fail('Times must look like 2026-11-23T12:00')
      const created: PlanEvent = {
        ...event,
        uid: `${newId('custom')}@learning-curve`,
        kind: event.availability === 'free' ? 'personal' : 'study',
      }
      if (patchProblem(created, {})) fail('The event must end after it starts')
      next.added.push(created)
      break
    }
    case 'event.remove': {
      const { uid } = change
      if (!next.added.some((e) => e.uid === uid) && !base.events.some((e) => e.uid === uid)) {
        fail(`Unknown event "${uid}"`)
      }
      removed.events[uid] = removedAt
      break
    }
    case 'calendar.save': {
      const id = change.id ?? newId('cal')
      if (change.id && !calendarExists(change.id)) fail(`Unknown calendar "${change.id}"`)
      next.calendars[id] = { name: change.name, color: change.color }
      break
    }
    case 'calendar.remove': {
      const { id } = change
      if (!calendarExists(id)) fail(`Unknown calendar "${id}"`)
      if (applyEdits(base, next).plan.calendars.length < 2) fail('The last calendar cannot be removed')
      removed.calendars[id] = removedAt
      break
    }
    case 'calendar.clear': {
      const { id } = change
      if (!calendarExists(id)) fail(`Unknown calendar "${id}"`)
      for (const event of applyEdits(base, next).plan.events) {
        if (event.calendar === id) removed.events[event.uid] = removedAt
      }
      break
    }
    case 'trash.restore': {
      const everything = !change.events && !change.calendars
      // A `null` mark is past restoring: the trash no longer lists it.
      for (const uid of everything ? Object.keys(removed.events) : (change.events ?? [])) {
        if (removed.events[uid]) delete removed.events[uid]
      }
      for (const id of everything ? Object.keys(removed.calendars) : (change.calendars ?? [])) {
        if (removed.calendars[id]) delete removed.calendars[id]
      }
      break
    }
    case 'trash.empty':
      return purgeTrash(base, next, Infinity)
  }
  return next
}

/** True for an event created in the viewer, not generated from the course content. */
export const isCustomEvent = (event: PlanEvent) => event.uid.startsWith('custom-')

/** Uids that differ from `base` after `edits`: patched or created. */
export const editedUids = (edits: PlanEdits): string[] => [
  ...Object.keys(edits.events),
  ...edits.added.map((e) => e.uid),
]

/** `base` with one more change, for a plan that lives only in the browser (an opened file). */
export const withChange = (base: Plan, edits: PlanEdits, change: PlanChange) => {
  const next = applyChange(base, edits, change)
  return { edits: next, plan: applyEdits(base, next).plan }
}
