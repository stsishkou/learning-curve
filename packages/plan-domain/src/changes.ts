import { DAY, parseLocal, toLocalString, weekday } from './dates'
import {
  HEX_COLOR,
  LOCAL_TIME,
  TITLE_MAX,
  applyEdits,
  isRecord,
  parsePatch,
  patchProblem,
  without,
  type EventPatch,
  type PlanEdits,
} from './edits'
import { isSession } from './progress'
import { PLAIN_WEEKLY_RULE, weekdaysOf } from './recurrence'
import type { SessionMove } from './replan'
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
  /** `lab` for a hands-on session that cannot be paused; a session is `study` when this is left out */
  kind?: 'study' | 'lab'
  /**
   * Makes the event repeat every week on the named days, e.g. `FREQ=WEEKLY;BYDAY=TU,TH`. `start` is the first
   * repeat and must fall on one of those days. A repeat is a habit, never a course session: it cannot be marked done
   */
  rrule?: string
}

/** A session of a course that is being added: its calendar is the course itself. */
export type NewSession = Omit<NewEvent, 'calendar'>

/** One change a person makes to the plan in the viewer. The same value is applied in the browser and stored by the server. */
export type PlanChange =
  /** `null` drops the manual changes of a generated event */
  | { type: 'event.patch'; uid: string; patch: EventPatch | null }
  | { type: 'event.add'; event: NewEvent }
  /** Moves the event to the trash */
  | { type: 'event.remove'; uid: string }
  /**
   * Moves one repeat of a series and leaves the others where they are: the repeat on `day` (`YYYY-MM-DD`) is
   * skipped and an event of its own takes its place at `start`–`end`
   */
  | { type: 'event.detach'; uid: string; day: string; start: string; end: string }
  /** Without an id a new calendar is created */
  | { type: 'calendar.save'; id?: string | undefined; name: string; color: string }
  /** Moves the calendar and its events to the trash */
  | { type: 'calendar.remove'; id: string }
  /** Moves every event of the calendar to the trash and keeps the calendar */
  | { type: 'calendar.clear'; id: string }
  /** Brings back the listed events and calendars, or the whole trash when neither is given */
  | { type: 'trash.restore'; events?: string[] | undefined; calendars?: string[] | undefined }
  /** Removes everything in the trash for good */
  | { type: 'trash.empty' }
  /**
   * Moves every session that is not done and starts on `from` (`YYYY-MM-DD`) or later by a number of days,
   * in one calendar or in all of them: the way to catch up after time off
   */
  | { type: 'events.shift'; calendar?: string | undefined; from: string; days: number }
  /** Puts several sessions into new slots as one step: a catch-up scenario */
  | { type: 'events.move'; moves: SessionMove[]; paced?: boolean | undefined }
  /** Marks several sessions done or not done as one step */
  | { type: 'events.done'; uids: string[]; done: boolean }
  /** Gives the plan another name: the heading of the viewer and the names of the files it downloads */
  | { type: 'plan.rename'; title: string }
  /** Adds the review sessions of one finished module, as one step */
  | { type: 'reviews.plan'; reviews: NewEvent[] }
  /** Adds a course as one step: a new calendar with that name and color, and its sessions in it */
  | { type: 'course.add'; name: string; color: string; sessions: NewSession[] }
  /** Adds several events to calendars that exist, as one step */
  | { type: 'events.add'; events: NewEvent[] }

/** A change that cannot be applied; `message` is safe to show. */
export class PlanChangeError extends Error {}

const fail = (message: string): never => {
  throw new PlanChangeError(message)
}

function parseNewSession(raw: unknown): NewSession {
  const patch = parsePatch(isRecord(raw) ? { ...raw, rrule: undefined, calendar: undefined } : raw)
  if (!isRecord(raw) || !patch?.title || !patch.start || !patch.end) {
    return fail('A new event needs a title, a start and an end, with times like 2026-11-23T12:00')
  }
  const event: NewSession = {
    title: patch.title,
    start: patch.start,
    end: patch.end,
    description: patch.description ?? '',
    availability: raw.availability === 'free' ? 'free' : 'busy',
  }
  if (raw.kind === 'lab') event.kind = 'lab'
  if (raw.rrule !== undefined) {
    const { rrule } = raw
    if (typeof rrule !== 'string' || !PLAIN_WEEKLY_RULE.test(rrule)) {
      return fail(`"${patch.title}": rrule must look like FREQ=WEEKLY;BYDAY=TU,TH`)
    }
    if (!weekdaysOf(rrule).includes(weekday(parseLocal(patch.start)))) {
      return fail(`"${patch.title}": the first repeat must start on one of the days of its rrule`)
    }
    event.rrule = rrule
  }
  return event
}

function parseNewEvent(raw: unknown): NewEvent {
  const session = parseNewSession(raw)
  const calendar = isRecord(raw) && typeof raw.calendar === 'string' ? raw.calendar.trim() : ''
  return calendar ? { calendar, ...session } : fail(`"${session.title}": a new event needs a calendar`)
}

/** At most this many events come in one change: more is a mistake, not a plan. */
const MANY_MAX = 400

function parseMany<T>(value: unknown, name: string, parse: (raw: unknown) => T): T[] {
  if (!Array.isArray(value) || !value.length) return fail(`${name} must list the events to add`)
  if (value.length > MANY_MAX) return fail(`${name} lists more than ${MANY_MAX} events`)
  return value.map(parse)
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
    case 'event.add':
      return { type: 'event.add', event: parseNewEvent(input.event) }
    case 'reviews.plan':
      return { type: 'reviews.plan', reviews: parseMany(input.reviews, 'reviews', parseNewEvent) }
    case 'events.add':
      return { type: 'events.add', events: parseMany(input.events, 'events', parseNewEvent) }
    case 'course.add': {
      const color = text('color')
      if (!HEX_COLOR.test(color)) return fail('color must look like #1a2b3c')
      return {
        type: 'course.add',
        name: text('name'),
        color,
        sessions: parseMany(input.sessions, 'sessions', parseNewSession),
      }
    }
    case 'event.remove':
      return { type: 'event.remove', uid: text('uid') }
    case 'plan.rename':
      return { type: 'plan.rename', title: text('title').slice(0, TITLE_MAX) }
    case 'calendar.save': {
      const color = text('color')
      if (!HEX_COLOR.test(color)) return fail('color must look like #1a2b3c')
      const id = typeof input.id === 'string' && input.id ? input.id : undefined
      return { type: 'calendar.save', id, name: text('name'), color }
    }
    case 'event.detach': {
      const [day, start, end] = [text('day'), text('start'), text('end')]
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail('day must look like 2026-11-23')
      if (!LOCAL_TIME.test(start) || !LOCAL_TIME.test(end)) return fail('Times must look like 2026-11-23T12:00')
      return { type: 'event.detach', uid: text('uid'), day, start, end }
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
    case 'events.shift': {
      const { days, calendar } = input
      if (typeof days !== 'number' || !Number.isInteger(days) || days === 0 || Math.abs(days) > 366) {
        return fail('days must be a whole number of days, not zero')
      }
      const from = text('from')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return fail('from must look like 2026-11-23')
      return {
        type: 'events.shift',
        calendar: typeof calendar === 'string' && calendar ? calendar : undefined,
        from,
        days,
      }
    }
    case 'events.move': {
      const { moves } = input
      if (!Array.isArray(moves) || !moves.length) return fail('moves must be a list of sessions and their slots')
      return {
        type: 'events.move',
        moves: moves.map((move: unknown) => {
          if (!isRecord(move) || typeof move.uid !== 'string') return fail('A move needs a uid')
          const { uid, start, end } = move
          if (
            typeof start !== 'string' ||
            typeof end !== 'string' ||
            !LOCAL_TIME.test(start) ||
            !LOCAL_TIME.test(end)
          ) {
            return fail('Times must look like 2026-11-23T12:00')
          }
          return { uid, start, end }
        }),
        paced: input.paced === true ? true : undefined,
      }
    }
    case 'events.done': {
      const { uids, done } = input
      if (!Array.isArray(uids) || !uids.every((uid) => typeof uid === 'string') || typeof done !== 'boolean') {
        return fail('uids must be a list of ids and done a boolean')
      }
      return { type: 'events.done', uids, done }
    }
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
    ...(edits.title ? { title: edits.title } : {}),
  }
  const { removed } = next
  const removedAt = new Date(now).toISOString()
  const calendarExists = (id: string) =>
    !(id in removed.calendars) && (id in next.calendars || base.calendars.some((c) => c.id === id))
  /** One more event created in the viewer */
  const add = (
    event: NewEvent,
    kind: PlanEvent['kind'] = event.kind ?? (event.availability === 'free' ? 'personal' : 'study'),
  ) => {
    if (!calendarExists(event.calendar)) fail(`Unknown calendar "${event.calendar}"`)
    if (!LOCAL_TIME.test(event.start) || !LOCAL_TIME.test(event.end)) fail('Times must look like 2026-11-23T12:00')
    const created: PlanEvent = { ...event, uid: `${newId('custom')}@learning-curve`, kind }
    if (patchProblem(created, {})) fail('The event must end after it starts')
    next.added.push(created)
  }

  switch (change.type) {
    case 'event.patch': {
      const { uid, patch } = change
      if (patch?.calendar && !calendarExists(patch.calendar)) fail(`Unknown calendar "${patch.calendar}"`)
      const current = next.added.find((e) => e.uid === uid)
      if (current) {
        if (!patch) return next
        const { rrule, skip, ...fields } = patch
        // Only an event that repeats can change its days or skip one.
        const repeat = current.rrule ? { ...(rrule ? { rrule } : {}), ...(skip ? { skip } : {}) } : {}
        const merged: PlanEvent = { ...current, ...fields, ...repeat }
        if (!merged.skip?.length) delete merged.skip
        if (!merged.done) {
          delete merged.done
          delete merged.actual
        }
        if (patchProblem(merged, {})) fail('The event must end after it starts')
        next.added[next.added.indexOf(current)] = merged
        return next
      }
      const original = base.events.find((e) => e.uid === uid) ?? fail(`Unknown event "${uid}"`)
      if (!patch) {
        next.events = without(next.events, uid)
        return next
      }
      const merged: EventPatch = { ...next.events[uid], ...patch }
      // Keep only what differs from the original event, so the edits list real changes.
      for (const key of ['title', 'description', 'start', 'end', 'calendar', 'rrule'] as const) {
        // oxlint-disable-next-line typescript/no-dynamic-delete -- the key is one of the six names above
        if (merged[key] === original[key]) delete merged[key]
      }
      if (!(merged.done ?? original.done)) delete merged.actual
      if (!merged.done === !original.done) delete merged.done
      if (!merged.skip?.length || !original.rrule) delete merged.skip
      if (!original.rrule) delete merged.rrule
      if (patchProblem(original, merged)) fail('The event must end after it starts')
      if (Object.keys(merged).length) next.events[uid] = merged
      else next.events = without(next.events, uid)
      break
    }
    case 'event.add':
      add(change.event)
      break
    case 'events.add':
      for (const event of change.events) add(event)
      break
    case 'course.add': {
      const taken = applyEdits(base, next).plan.calendars.some(
        (c) => c.name.trim().toLowerCase() === change.name.toLowerCase(),
      )
      if (taken) fail(`A calendar named "${change.name}" already exists: add its sessions with events.add`)
      const id = newId('cal')
      next.calendars[id] = { name: change.name, color: change.color }
      for (const session of change.sessions) add({ ...session, calendar: id })
      break
    }
    case 'reviews.plan':
      for (const review of change.reviews) add(review, 'review')
      break
    case 'event.detach': {
      const series = applyEdits(base, next).plan.events.find((e) => e.uid === change.uid && e.rrule)
      if (!series) return fail(`Unknown repeating event "${change.uid}"`)
      const { rrule: _rule, skip = [], done: _done, ...copy } = series
      const single: PlanEvent = {
        ...copy,
        uid: `${newId('custom')}@learning-curve`,
        start: change.start,
        end: change.end,
      }
      if (patchProblem(single, {})) fail('The event must end after it starts')
      const skipped = applyChange(
        base,
        next,
        { type: 'event.patch', uid: series.uid, patch: { skip: [...new Set([...skip, change.day])] } },
        now,
      )
      skipped.added.push(single)
      return skipped
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
        if (removed.events[uid]) removed.events = without(removed.events, uid)
      }
      for (const id of everything ? Object.keys(removed.calendars) : (change.calendars ?? [])) {
        if (removed.calendars[id]) removed.calendars = without(removed.calendars, id)
      }
      break
    }
    case 'trash.empty':
      return purgeTrash(base, next, Infinity)
    case 'plan.rename':
      // The generated name again is no edit at all.
      if (change.title === base.meta.title) delete next.title
      else next.title = change.title
      break
    case 'events.shift': {
      if (change.calendar && !calendarExists(change.calendar)) fail(`Unknown calendar "${change.calendar}"`)
      const moved = shiftTargets(applyEdits(base, next).plan, change)
      if (!moved.length) fail('No sessions to move')
      return moved.reduce((sofar, event) => {
        const patch = {
          start: toLocalString(parseLocal(event.start) + change.days * DAY),
          end: toLocalString(parseLocal(event.end) + change.days * DAY),
        }
        return applyChange(base, sofar, { type: 'event.patch', uid: event.uid, patch }, now)
      }, next)
    }
    case 'events.move':
      return change.moves.reduce(
        (sofar, { uid, start, end }) =>
          applyChange(
            base,
            sofar,
            { type: 'event.patch', uid, patch: change.paced ? { start, end, paced: true } : { start, end } },
            now,
          ),
        next,
      )
    case 'events.done': {
      const known = new Set(applyEdits(base, next).plan.events.map((e) => e.uid))
      return change.uids
        .filter((uid) => known.has(uid))
        .reduce(
          (sofar, uid) => applyChange(base, sofar, { type: 'event.patch', uid, patch: { done: change.done } }, now),
          next,
        )
    }
  }
  return next
}

/** The sessions an `events.shift` change would move, in `plan` as it is shown. */
export const shiftTargets = (plan: Plan, change: { calendar?: string | undefined; from: string }): PlanEvent[] =>
  plan.events.filter(
    (e) =>
      isSession(e) &&
      !e.done &&
      e.start.slice(0, 10) >= change.from &&
      (!change.calendar || e.calendar === change.calendar),
  )

/** True for an event created in the viewer, not generated from the course content. */
export const isCustomEvent = (event: PlanEvent) => event.uid.startsWith('custom-')

/** Uids that differ from `base` after `edits`: patched or created. */
export const editedUids = (edits: PlanEdits): string[] => [
  ...Object.keys(edits.events),
  ...edits.added.map((e) => e.uid),
]
