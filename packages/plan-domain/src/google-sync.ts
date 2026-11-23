// What keeping the plan in Google Calendar means, without the API itself: how a plan event is written there, what
// has to be sent after a change, and what a person's edit in Google proposes for the plan. The plan stays the source
// of truth: nothing read from Google changes it until the person accepts it as a change.
import type { PlanChange } from './changes'
import { DAY, parseLocal, toLocalString, toMinsk, ymd } from './dates'
import { tookNote } from './ics'
import { skipDay } from './occurrence-changes'
import { hashText } from './revisions'
import type { Plan, PlanCalendar, PlanEvent } from './types'

const BASE32HEX = '0123456789abcdefghijklmnopqrstuv'
const DONE = '✓ '

/**
 * Google's id for the event with `uid`: its UTF-8 bytes in lowercase base32hex, the alphabet an event id may use.
 * The same uid always gives the same id, so writing an event twice updates it, and a lost record of what was
 * written can be rebuilt from the calendar.
 */
export function googleEventId(uid: string): string {
  let value = 0
  let bits = 0
  let id = ''
  for (const byte of new TextEncoder().encode(uid)) {
    value = ((value << 8) | byte) & 0xfff
    bits += 8
    while (bits >= 5) {
      id += BASE32HEX.charAt((value >>> (bits - 5)) & 31)
      bits -= 5
    }
  }
  return bits > 0 ? id + BASE32HEX.charAt((value << (5 - bits)) & 31) : id
}

/** The uid a `googleEventId` was made from; null for any other id, such as one of an event made in Google. */
export function uidOfGoogleId(id: string): string | null {
  let value = 0
  let bits = 0
  const bytes: number[] = []
  for (const char of id) {
    const digit = BASE32HEX.indexOf(char)
    if (digit < 0) return null
    value = ((value << 5) | digit) & 0xfff
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes))
  } catch {
    return null
  }
}

export interface GoogleTime {
  dateTime?: string
  date?: string
  timeZone?: string
}

/** A Google Calendar event as the API returns it: the fields the sync reads. */
export interface GoogleEvent {
  id: string
  etag?: string
  status?: string
  summary?: string
  description?: string
  start?: GoogleTime
  end?: GoogleTime
  recurrence?: string[]
  /** Set on one repeat of a series that was changed or cancelled on its own */
  recurringEventId?: string
  originalStartTime?: GoogleTime
  extendedProperties?: { private?: Record<string, string> }
}

/** What the app writes to a Google event: the fields it owns. */
export interface GoogleBody {
  id: string
  summary: string
  description: string
  start: GoogleTime
  end: GoogleTime
  recurrence?: string[]
  /** A done session no longer blocks its time, as a free event never did */
  transparency: 'opaque' | 'transparent'
  extendedProperties: { private: { lcUid: string } }
}

/** One plan event as it is written to Google: a done one with ✓ before its title and the real time first in its notes. */
export function googleBody(event: PlanEvent, timeZone: string): GoogleBody {
  const done = event.done === true
  const day = event.start.slice(0, 10)
  const body: GoogleBody = {
    id: googleEventId(event.uid),
    summary: done ? `${DONE}${event.title}` : event.title,
    description: [tookNote(event), event.description].filter(Boolean).join('\n\n'),
    start: event.allDay ? { date: day } : { dateTime: `${event.start}:00`, timeZone },
    end: event.allDay ? { date: ymd(parseLocal(day) + DAY) } : { dateTime: `${event.end}:00`, timeZone },
    transparency: done || event.availability === 'free' ? 'transparent' : 'opaque',
    extendedProperties: { private: { lcUid: event.uid } },
  }
  if (event.rrule) {
    const at = event.start.slice(11, 16).replace(':', '')
    body.recurrence = [
      `RRULE:${event.rrule}`,
      ...(event.skip ?? []).map((skipped) => `EXDATE;TZID=${timeZone}:${skipped.replaceAll('-', '')}T${at}00`),
    ]
  }
  return body
}

/** A Google time as a plan wall-clock string, `YYYY-MM-DDTHH:MM`, or a bare `YYYY-MM-DD` for a whole day. */
export function wallOf(time: GoogleTime | undefined): string | null {
  if (time?.date) return time.date
  const instant = time?.dateTime ? Date.parse(time.dateTime) : Number.NaN
  return Number.isNaN(instant) ? null : toLocalString(toMinsk(instant))
}

/** What the app last wrote to one Google event, or accepted from it. */
export interface GoogleRow {
  /** The Google calendar it is in */
  calendar: string
  etag: string
  /** `hashText` of the body written; empty to have it written again */
  hash: string
  /** Its title and times as written, to tell what a person changed in Google */
  summary: string
  start: string
  end: string
}

export interface GoogleCalendarRow {
  id: string
  summary: string
  /** Where the last read of its events ended; absent before the first full read */
  syncToken?: string | undefined
}

/** What is kept between two rounds of the sync, by plan calendar id and by event uid. */
export interface GoogleState {
  calendars: Record<string, GoogleCalendarRow>
  events: Record<string, GoogleRow>
}

export const bodyHash = (body: GoogleBody) => hashText(JSON.stringify(body))

/** The row for a body Google has just stored with `etag`. */
export const rowOf = (body: GoogleBody, calendar: string, etag: string): GoogleRow => ({
  calendar,
  etag,
  hash: bodyHash(body),
  summary: body.summary,
  start: body.start.date ?? wallOf(body.start) ?? '',
  end: body.end.date ?? wallOf(body.end) ?? '',
})

export interface PushPlan {
  /** Plan calendars that have no Google calendar yet; their events wait for the next round */
  create: PlanCalendar[]
  rename: { id: string; summary: string }[]
  insert: { uid: string; calendar: string; body: GoogleBody }[]
  /** Moved to another calendar first, then patched when `body` differs from what was written */
  move: { uid: string; from: string; to: string }[]
  patch: { uid: string; calendar: string; body: GoogleBody; etag: string }[]
  remove: { uid: string; calendar: string; etag: string }[]
}

/**
 * What has to be written to Google for it to show `plan`, worked out from state rather than from the edits that led
 * there: an edit, an undo, `pnpm run plan` and a change made by a model all reach Google the same way. Events with a
 * proposal waiting (`frozen`) are left as they are in Google until the person decides.
 */
export function planPush(plan: Plan, state: GoogleState, frozen: ReadonlySet<string> = new Set()): PushPlan {
  const out: PushPlan = { create: [], rename: [], insert: [], move: [], patch: [], remove: [] }
  for (const calendar of plan.calendars) {
    const row = state.calendars[calendar.id]
    if (!row) out.create.push(calendar)
    else if (row.summary !== calendar.name) out.rename.push({ id: row.id, summary: calendar.name })
  }
  const kept = new Set<string>()
  for (const event of plan.events) {
    kept.add(event.uid)
    const calendar = state.calendars[event.calendar]?.id
    if (!calendar || frozen.has(event.uid)) continue
    const body = googleBody(event, plan.meta.timezone)
    const row = state.events[event.uid]
    if (!row) {
      out.insert.push({ uid: event.uid, calendar, body })
      continue
    }
    if (row.calendar !== calendar) out.move.push({ uid: event.uid, from: row.calendar, to: calendar })
    if (row.hash !== bodyHash(body)) out.patch.push({ uid: event.uid, calendar, body, etag: row.etag })
  }
  for (const [uid, row] of Object.entries(state.events)) {
    if (!kept.has(uid) && !frozen.has(uid)) out.remove.push({ uid, calendar: row.calendar, etag: row.etag })
  }
  return out
}

/** An edit made in Google, offered to the person as a change to the plan. */
export interface Proposal {
  uid: string
  /** The change; null for a session deleted in Google, where the person picks between the trash and putting it back */
  change: PlanChange | null
  /** Google's etag of the event when it was read */
  etag: string
  /** `bodyHash` of the plan event when it was read: once the plan has moved on, the proposal is stale */
  basis: string
}

/** What one event read from Google means for the plan. */
export type Reading =
  /** Nothing the plan follows changed (the app's own write coming back, a colour, a reminder): note the etag */
  | { kind: 'seen'; uid: string; etag: string }
  /** Its title was edited: the plan owns the text, so the next round writes it back */
  | { kind: 'reset'; uid: string; etag: string }
  | { kind: 'proposal'; proposals: Proposal[] }
  /** Not an event the app wrote, or one it is not keeping any more */
  | { kind: 'foreign' }

const plain = (summary: string) => summary.replace(/^✓\s*/, '')
const marked = (summary: string) => summary.startsWith('✓')

/** A plan wall-clock moment for a Google time: a whole day starts at midnight. */
const wallStart = (wall: string) => (wall.length === 10 ? `${wall}T00:00` : wall)

/**
 * What an event read from Google proposes. A ✓ typed before the title marks the session done and taking it away
 * marks it not done; a single session moved in Google moves in the plan; one repeat moved or deleted there leaves
 * its series or is skipped; a session deleted there asks what to do. The rest of the text belongs to the plan.
 */
export function readGoogleEvent(item: GoogleEvent, plan: Plan, state: GoogleState): Reading {
  const uid = item.extendedProperties?.private?.lcUid ?? uidOfGoogleId(item.recurringEventId ?? item.id)
  const event = uid ? plan.events.find((e) => e.uid === uid) : undefined
  const row = uid ? state.events[uid] : undefined
  if (!uid || !event || !row) return { kind: 'foreign' }
  const etag = item.etag ?? ''
  if (etag === row.etag) return { kind: 'seen', uid, etag }
  const basis = bodyHash(googleBody(event, plan.meta.timezone))
  const propose = (...changes: (PlanChange | null)[]): Reading => ({
    kind: 'proposal',
    proposals: changes.map((change) => ({ uid, change, etag, basis })),
  })

  if (item.recurringEventId) {
    const day = wallOf(item.originalStartTime)?.slice(0, 10)
    if (!day) return { kind: 'seen', uid, etag }
    if (item.status === 'cancelled')
      return event.skip?.includes(day) ? { kind: 'seen', uid, etag } : propose(skipDay(event, day))
    const start = wallOf(item.start)
    const end = wallOf(item.end)
    const slot = `${day}T${event.start.slice(11, 16)}`
    if (!start || !end || event.allDay || start === slot) return { kind: 'seen', uid, etag }
    return propose({ type: 'event.detach', uid, day, start, end })
  }

  if (item.status === 'cancelled') return propose(null)

  const changes: PlanChange[] = []
  const summary = item.summary ?? ''
  if (marked(summary) !== marked(row.summary) && marked(summary) !== (event.done === true)) {
    changes.push({ type: 'events.done', uids: [uid], done: marked(summary) })
  }
  const start = wallOf(item.start)
  const end = wallOf(item.end)
  // A series moved as a whole in Google would need its rule rewritten: the plan's own series is written back.
  if (!event.rrule && start && end && (start !== row.start || end !== row.end)) {
    const from = wallStart(start)
    const to = event.allDay ? toLocalString(parseLocal(from) + parseLocal(event.end) - parseLocal(event.start)) : end
    if (from !== event.start || to !== event.end)
      changes.push({ type: 'event.patch', uid, patch: { start: from, end: to } })
  }
  if (changes.length) return propose(...changes)
  const retitled = plain(summary) !== plain(row.summary)
  const reshaped = event.rrule !== undefined && (start !== row.start || end !== row.end)
  return retitled || reshaped ? { kind: 'reset', uid, etag } : { kind: 'seen', uid, etag }
}
