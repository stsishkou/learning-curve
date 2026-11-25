import { DAY, HOUR, parseLocal, startOfDay, toLocalString, weekday } from './dates'
import {
  HEX_COLOR,
  LOCAL_TIME,
  ORIGIN_FIELDS,
  STOPWATCH_FIELDS,
  TITLE_MAX,
  applyEdits,
  forgetFinish,
  isRecord,
  parsePatch,
  patchProblem,
  without,
  withoutRecord,
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
  /**
   * `lab` for a hands-on session that cannot be paused; a session is `study` when this is left out. `milestone` is
   * the calendar's deadline: all day and free, with `start` and `end` both at 00:00 of its day
   */
  kind?: 'study' | 'lab' | 'milestone'
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
  /**
   * Splits a session into parts that add up to its length: the first part keeps the event and its uid, the others
   * are new events with the same title and notes
   */
  | { type: 'event.split'; uid: string; parts: Slot[] }
  /** Without an id a new calendar is created */
  | { type: 'calendar.save'; id?: string | undefined; name: string; color: string }
  /** Moves the calendar and its events to the trash */
  | { type: 'calendar.remove'; id: string }
  /** Moves every event of the calendar to the trash and keeps the calendar */
  | { type: 'calendar.clear'; id: string }
  /** Lists the calendars in this order; the ones not named follow in their own order */
  | { type: 'calendars.order'; ids: string[] }
  /** Hides the calendar and its events from every view, or shows them again; they stay planned */
  | { type: 'calendar.hide'; id: string; hidden: boolean }
  /** Brings back the listed events and calendars, or the whole trash when neither is given */
  | { type: 'trash.restore'; events?: string[] | undefined; calendars?: string[] | undefined }
  /** Removes everything in the trash for good */
  | { type: 'trash.empty' }
  /**
   * Moves every session that is not done and starts on `from` (`YYYY-MM-DD`) or later by days, hours or both, in the
   * `calendars` named or in all of them: the way to catch up after time off, or to study later in the day
   */
  | {
      type: 'events.shift'
      /** Ids, each once; absent for every calendar */
      calendars?: string[] | undefined
      from: string
      days?: number | undefined
      hours?: number | undefined
    }
  /** Puts several sessions into new slots as one step: a catch-up scenario, or the re-balance of `calendar` */
  | {
      type: 'events.move'
      moves: SessionMove[]
      paced?: boolean | undefined
      reason?: 'rebalance' | undefined
      calendar?: string | undefined
    }
  /** Marks several sessions done or not done as one step; `actual` logs the minutes some of them took, by uid */
  | { type: 'events.done'; uids: string[]; done: boolean; actual?: Record<string, number> | undefined }
  /**
   * Finishes a session timed by the Focus page's stopwatch: done, with the minutes worked, the moment the stopwatch
   * first started (Minsk wall-clock) and the minutes it stood paused. Only the app sends it, never an update
   */
  | { type: 'session.finish'; uid: string; actual: number; began: string; paused: number }
  /** Gives the plan another name: the heading of the viewer and the names of the files it downloads */
  | { type: 'plan.rename'; title: string }
  /** Names the calendar whose deadline the countdown follows; null: the nearest deadline, whichever calendar's it is */
  | { type: 'plan.countdown'; calendar: string | null }
  /** Adds the review sessions of one finished module, as one step */
  | { type: 'reviews.plan'; reviews: NewEvent[] }
  /** Adds a course as one step: a new calendar with that name and color, and its sessions in it */
  | { type: 'course.add'; name: string; color: string; sessions: NewSession[] }
  /** Adds several events to calendars that exist, as one step */
  | { type: 'events.add'; events: NewEvent[] }

/** A stretch of time on one day, as wall-clock strings. */
export interface Slot {
  start: string
  end: string
}

/** At most this many parts come out of one session. */
export const SPLIT_PARTS_MAX = 8

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
  if (raw.kind === 'milestone') {
    if (patch.start !== patch.end || !patch.start.endsWith('T00:00')) {
      return fail(`"${patch.title}": a milestone starts and ends at 00:00 of its day`)
    }
    if (raw.rrule !== undefined) return fail(`"${patch.title}": a milestone never repeats`)
    return { ...event, kind: 'milestone', availability: 'free' }
  }
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
      const raw = input.patch
      if (isRecord(raw) && STOPWATCH_FIELDS.some((key) => raw[key] !== undefined)) {
        return fail(`${STOPWATCH_FIELDS.join(', ')} are written by the stopwatch of the Focus page, never sent`)
      }
      if (isRecord(raw) && ORIGIN_FIELDS.some((key) => raw[key] !== undefined)) {
        return fail(`${ORIGIN_FIELDS.join(' and ')} are kept by the app, never sent`)
      }
      const patch = parsePatch(raw)
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
    case 'plan.countdown':
      return { type: 'plan.countdown', calendar: input.calendar === null ? null : text('calendar') }
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
    case 'event.split': {
      const { parts } = input
      if (!Array.isArray(parts) || parts.length < 2 || parts.length > SPLIT_PARTS_MAX) {
        return fail(`parts must list 2 to ${SPLIT_PARTS_MAX} slots`)
      }
      return {
        type: 'event.split',
        uid: text('uid'),
        parts: parts.map((part: unknown): Slot => {
          const start = isRecord(part) ? part.start : undefined
          const end = isRecord(part) ? part.end : undefined
          return typeof start === 'string' && typeof end === 'string' && LOCAL_TIME.test(start) && LOCAL_TIME.test(end)
            ? { start, end }
            : fail('A part needs a start and an end like 2026-11-23T12:00')
        }),
      }
    }
    case 'calendar.remove':
      return { type: 'calendar.remove', id: text('id') }
    case 'calendar.clear':
      return { type: 'calendar.clear', id: text('id') }
    case 'calendars.order': {
      const { ids } = input
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        !ids.every((id): id is string => typeof id === 'string' && id !== '') ||
        new Set(ids).size !== ids.length
      ) {
        return fail('ids must list calendar ids, each once')
      }
      return { type: 'calendars.order', ids }
    }
    case 'calendar.hide':
      return typeof input.hidden === 'boolean'
        ? { type: 'calendar.hide', id: text('id'), hidden: input.hidden }
        : fail('hidden must be true or false')
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
      const amount = (key: 'days' | 'hours', valid: (n: number) => boolean, message: string): number | undefined => {
        const value = input[key]
        if (value === undefined || value === 0) return undefined
        return typeof value === 'number' && valid(value) ? value : fail(message)
      }
      const days = amount('days', (n) => Number.isInteger(n) && Math.abs(n) <= 366, 'days must be a whole number')
      const hours = amount(
        'hours',
        (n) => Number.isInteger(n * 2) && Math.abs(n) <= 23.5,
        'hours must be whole or half, less than a day',
      )
      if (days === undefined && hours === undefined) return fail('Give days or hours to shift by, not zero')
      const from = text('from')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return fail('from must look like 2026-11-23')
      // A change stored before a shift could take several calendars names its one `calendar`.
      const { calendars = typeof input.calendar === 'string' && input.calendar ? [input.calendar] : undefined } = input
      const valid =
        calendars === undefined ||
        (Array.isArray(calendars) &&
          calendars.length > 0 &&
          calendars.every((id): id is string => typeof id === 'string' && id !== '') &&
          new Set(calendars).size === calendars.length)
      if (!valid) return fail('calendars must be a list of calendar ids, each once; leave it out for all')
      return {
        type: 'events.shift',
        calendars,
        from,
        days,
        hours,
      }
    }
    case 'events.move': {
      const { moves, reason, calendar } = input
      if (!Array.isArray(moves) || !moves.length) return fail('moves must be a list of sessions and their slots')
      if (reason !== undefined && reason !== 'rebalance') return fail('reason can only be "rebalance"')
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
        reason: reason === 'rebalance' ? 'rebalance' : undefined,
        calendar: typeof calendar === 'string' && calendar ? calendar : undefined,
      }
    }
    case 'events.done': {
      const { uids, done } = input
      if (!Array.isArray(uids) || !uids.every((uid) => typeof uid === 'string') || typeof done !== 'boolean') {
        return fail('uids must be a list of ids and done a boolean')
      }
      if (input.actual === undefined) return { type: 'events.done', uids, done }
      const times = input.actual
      if (!done || !isRecord(times) || Array.isArray(times)) {
        return fail('actual gives minutes by uid, only for sessions marked done')
      }
      const actual: Record<string, number> = {}
      for (const [uid, minutes] of Object.entries(times)) {
        const logged = parsePatch({ actual: minutes })?.actual
        if (!uids.includes(uid) || logged === undefined) {
          return fail(`actual of "${uid}" must be 5 to 1440 whole minutes, for a session in uids`)
        }
        actual[uid] = logged
      }
      return { type: 'events.done', uids, done, actual }
    }
    case 'session.finish': {
      const { actual, began, paused } =
        parsePatch({ actual: input.actual, began: input.began, paused: input.paused }) ?? {}
      if (actual === undefined || began === undefined || paused === undefined) {
        return fail('session.finish needs actual (5 to 1440 minutes), began like 2026-11-23T12:00 and paused minutes')
      }
      return { type: 'session.finish', uid: text('uid'), actual, began, paused }
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
    ...(edits.countdown ? { countdown: edits.countdown } : {}),
    ...(edits.order ? { order: [...edits.order] } : {}),
    ...(edits.hidden ? { hidden: [...edits.hidden] } : {}),
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
    const created: PlanEvent = {
      ...event,
      uid: `${newId('custom')}@learning-curve`,
      kind,
      ...(kind === 'milestone' ? { allDay: true } : {}),
    }
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
        const kept = fields.actual === undefined ? current : withoutRecord(current)
        const merged: PlanEvent = { ...kept, ...fields, ...repeat }
        // The first resize keeps the length the session was planned with.
        if (merged.estimate === undefined && length(merged) !== length(current)) {
          merged.estimate = length(current) / MINUTE
        }
        if (!merged.skip?.length) delete merged.skip
        if (!merged.done) {
          delete merged.done
          forgetFinish(merged)
        }
        if (!merged.unfinished) delete merged.unfinished
        if (patchProblem(merged, {})) fail('The event must end after it starts')
        next.added[next.added.indexOf(current)] = merged
        return next
      }
      const original = base.events.find((e) => e.uid === uid) ?? fail(`Unknown event "${uid}"`)
      if (!patch) {
        next.events = without(next.events, uid)
        return next
      }
      const earlier = next.events[uid] ?? {}
      const merged: EventPatch = { ...(patch.actual === undefined ? earlier : withoutRecord(earlier)), ...patch }
      // Keep only what differs from the original event, so the edits list real changes.
      for (const key of ['title', 'description', 'start', 'end', 'calendar', 'rrule'] as const) {
        // oxlint-disable-next-line typescript/no-dynamic-delete -- the key is one of the six names above
        if (merged[key] === original[key]) delete merged[key]
      }
      if (!(merged.done ?? original.done)) forgetFinish(merged)
      if (!merged.unfinished) delete merged.unfinished
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
    case 'event.split': {
      const event =
        applyEdits(base, next).plan.events.find((e) => e.uid === change.uid) ?? fail(`Unknown event "${change.uid}"`)
      const problem = splitProblem(event)
      if (problem) fail(problem)
      if (change.parts.some((part) => length(part) <= 0 || part.start.slice(0, 10) !== part.end.slice(0, 10))) {
        fail('Each part must end after it starts, on the same day')
      }
      const total = change.parts.reduce((sum, part) => sum + length(part), 0)
      if (total !== length(event)) fail(`The parts must add up to the length of the session, ${length(event) / HOUR} h`)
      const [first, ...rest] = change.parts
      if (!first) return fail('A split needs its parts')
      // The first part keeps the whole first length; the others name the session they came from, so they pool.
      const { uid: _uid, estimate: _estimate, ...copy } = event
      const split = applyChange(base, next, { type: 'event.patch', uid: event.uid, patch: { ...first } }, now)
      for (const part of rest) {
        split.added.push({ ...copy, ...part, from: event.from ?? event.uid, uid: `${newId('custom')}@learning-curve` })
      }
      return split
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
    case 'calendars.order': {
      const unknown = change.ids.find((id) => !calendarExists(id))
      if (unknown !== undefined) fail(`Unknown calendar "${unknown}"`)
      next.order = change.ids
      const listed = (sofar: PlanEdits) =>
        applyEdits(base, sofar)
          .plan.calendars.map((c) => c.id)
          .join()
      // The order the calendars come in by themselves is no edit at all.
      const { order: _order, ...natural } = next
      if (listed(next) === listed(natural)) delete next.order
      break
    }
    case 'calendar.hide': {
      const { id, hidden } = change
      if (!calendarExists(id)) fail(`Unknown calendar "${id}"`)
      const others = (next.hidden ?? []).filter((other) => other !== id)
      if (hidden && !applyEdits(base, next).plan.calendars.some((c) => c.id !== id && !c.hidden)) {
        fail('The last calendar shown cannot be hidden')
      }
      if (hidden) next.hidden = [...others, id]
      else if (others.length) next.hidden = others
      else delete next.hidden
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
    case 'plan.countdown':
      if (change.calendar === null) delete next.countdown
      else if (calendarExists(change.calendar)) next.countdown = change.calendar
      else fail(`Unknown calendar "${change.calendar}"`)
      break
    case 'events.shift': {
      const unknown = change.calendars?.find((id) => !calendarExists(id))
      if (unknown !== undefined) fail(`Unknown calendar "${unknown}"`)
      const moved = shiftTargets(applyEdits(base, next).plan, change)
      if (!moved.length) fail('No sessions to move')
      const days = change.days ?? 0
      const by = days * DAY + (change.hours ?? 0) * HOUR
      // Every session is checked before any moves, so a refused shift changes nothing.
      const patches = moved.map((event) => {
        const start = parseLocal(event.start) + by
        const end = parseLocal(event.end) + by
        const day = startOfDay(parseLocal(event.start)) + days * DAY
        if (change.hours && (startOfDay(start) !== day || end > day + DAY)) {
          fail(`"${event.title}" would cross midnight`)
        }
        return { uid: event.uid, patch: { start: toLocalString(start), end: toLocalString(end) } }
      })
      return patches.reduce(
        (sofar, { uid, patch }) => applyChange(base, sofar, { type: 'event.patch', uid, patch }, now),
        next,
      )
    }
    case 'events.move':
      if (change.calendar && !calendarExists(change.calendar)) fail(`Unknown calendar "${change.calendar}"`)
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
        .reduce((sofar, uid) => {
          const actual = change.done ? change.actual?.[uid] : undefined
          const patch: EventPatch = actual === undefined ? { done: change.done } : { done: true, actual }
          return applyChange(base, sofar, { type: 'event.patch', uid, patch }, now)
        }, next)
    }
    case 'session.finish': {
      const { uid, actual, began, paused } = change
      const patch: EventPatch = { done: true, actual, measured: true, began, ...(paused ? { paused } : {}) }
      return applyChange(base, next, { type: 'event.patch', uid, patch }, now)
    }
  }
  return next
}

const MINUTE = HOUR / 60
const length = (slot: Slot) => parseLocal(slot.end) - parseLocal(slot.start)

/** Why an event cannot be split, in words a model can act on; null when it can. */
export function splitProblem(event: PlanEvent): string | null {
  if (event.rrule) return 'A repeating event cannot be split: move one repeat with event.detach'
  if (event.allDay) return 'An all-day event cannot be split'
  if (event.kind === 'lab') return 'A lab is one block that cannot be paused: it cannot be split'
  if (event.done) return 'A finished session cannot be split'
  return null
}

/**
 * The session in two halves on the half hour, the second right after the first, ready to be dragged elsewhere.
 * null when it cannot be split or is shorter than an hour.
 */
export function splitInHalves(event: PlanEvent): Extract<PlanChange, { type: 'event.split' }> | null {
  if (splitProblem(event) || length(event) < HOUR) return null
  const half = HOUR / 2
  const middle = toLocalString(parseLocal(event.start) + Math.round(length(event) / 2 / half) * half)
  return {
    type: 'event.split',
    uid: event.uid,
    parts: [
      { start: event.start, end: middle },
      { start: middle, end: event.end },
    ],
  }
}

/** The sessions an `events.shift` change would move, in `plan` as it is shown. */
export const shiftTargets = (
  plan: Plan,
  change: { calendars?: readonly string[] | undefined; from: string },
): PlanEvent[] =>
  plan.events.filter(
    (e) =>
      isSession(e) &&
      !e.done &&
      e.start.slice(0, 10) >= change.from &&
      (!change.calendars || change.calendars.includes(e.calendar)),
  )

/** True for an event created in the viewer, not generated from the course content. */
export const isCustomEvent = (event: PlanEvent) => event.uid.startsWith('custom-')

/** Uids that differ from `base` after `edits`: patched or created. */
export const editedUids = (edits: PlanEdits): string[] => [
  ...Object.keys(edits.events),
  ...edits.added.map((e) => e.uid),
]
