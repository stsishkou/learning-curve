// What keeping the plan in Google Calendar means, without the API itself: how a plan event is written there, what
// has to be sent after a change, and what a person's edit in Google means for the plan. The plan stays the source of
// truth: an edit made in Google reaches it as a change, like one made in the planner, and Undo takes it back.
import { parseChange, type PlanChange } from './changes'
import { DAY, parseLocal, toLocalString, toMinsk, ymd } from './dates'
import type { EventPatch } from './edits'
import { tookNote } from './ics'
import { skipDay } from './occurrence-changes'
import { hashText } from './revisions'
import type { Plan, PlanCalendar, PlanEvent } from './types'
import { previewUpdate } from './update'

/** What the app asks Google for: the calendars it makes and their events, nothing else in the account */
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'

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
  const at = time?.dateTime
  if (!at) return null
  // Without an offset it is on the event's own clock, which the app writes in the plan's zone.
  if (!/(Z|[+-]\d\d:\d\d)$/.test(at)) return at.slice(0, 16)
  const instant = Date.parse(at)
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
  /** Plan calendars that are gone: their Google calendar is deleted once its events are */
  drop: string[]
}

/**
 * What has to be written to Google for it to show `plan`, worked out from state rather than from the edits that led
 * there: an edit, an undo, `pnpm run plan` and a change made by a model all reach Google the same way. Events with a
 * proposal waiting (`frozen`) are left as they are in Google until the person decides.
 */
export function planPush(plan: Plan, state: GoogleState, frozen: ReadonlySet<string> = new Set()): PushPlan {
  const out: PushPlan = { create: [], rename: [], insert: [], move: [], patch: [], remove: [], drop: [] }
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
  const calendars = new Set(plan.calendars.map((c) => c.id))
  out.drop = Object.keys(state.calendars).filter((id) => !calendars.has(id))
  return out
}

/** An edit made in Google, as a change to the plan. */
export interface Proposal {
  uid: string
  /** The Google event it was read from: the event itself, or one repeat of it */
  source: string
  /** The day of that repeat, when it is one */
  day?: string | undefined
  /** The change; null for a session deleted in Google, which goes to the trash */
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
  /** Its title was cleared, or a whole series was moved: the plan cannot take that, so its version is written back */
  | { kind: 'reset'; uid: string; etag: string }
  | { kind: 'proposal'; proposals: Proposal[] }
  /** Nothing to note: not an event the app keeps, or a repeat that matches the plan again */
  | { kind: 'none' }

const NONE: Reading = { kind: 'none' }
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
  if (!uid || !event || !row) return NONE
  const etag = item.etag ?? ''
  const day = item.recurringEventId ? wallOf(item.originalStartTime)?.slice(0, 10) : undefined
  const basis = bodyHash(googleBody(event, plan.meta.timezone))
  const propose = (...changes: (PlanChange | null)[]): Reading => ({
    kind: 'proposal',
    proposals: changes.map((change) => ({ uid, source: item.id, day, change, etag, basis })),
  })

  // A repeat has its own etag; the series' row is never noted from it.
  if (item.recurringEventId) {
    if (!day) return NONE
    if (item.status === 'cancelled') return event.skip?.includes(day) ? NONE : propose(skipDay(event, day))
    const start = wallOf(item.start)
    const end = wallOf(item.end)
    const slot = `${day}T${event.start.slice(11, 16)}`
    if (!start || !end || event.allDay || start === slot) return NONE
    return propose({ type: 'event.detach', uid, day, start, end })
  }
  if (etag === row.etag) return { kind: 'seen', uid, etag }

  if (item.status === 'cancelled') return propose(null)

  const changes: PlanChange[] = []
  const summary = item.summary ?? ''
  if (marked(summary) !== marked(row.summary) && marked(summary) !== (event.done === true)) {
    changes.push({ type: 'events.done', uids: [uid], done: marked(summary) })
  }
  const patch: EventPatch = {}
  const title = plain(summary).trim()
  const retitled = title !== plain(row.summary)
  if (retitled && title && title !== event.title) patch.title = title
  const start = wallOf(item.start)
  const end = wallOf(item.end)
  // A series moved as a whole in Google would need its rule rewritten: the plan's own series is written back.
  if (!event.rrule && start && end && (start !== row.start || end !== row.end)) {
    const from = wallStart(start)
    const to = event.allDay ? toLocalString(parseLocal(from) + parseLocal(event.end) - parseLocal(event.start)) : end
    if (from !== event.start || to !== event.end) Object.assign(patch, { start: from, end: to })
  }
  if (Object.keys(patch).length) changes.push({ type: 'event.patch', uid, patch })
  if (changes.length) return propose(...changes)
  const reshaped = event.rrule !== undefined && (start !== row.start || end !== row.end)
  return (retitled && !title) || reshaped ? { kind: 'reset', uid, etag } : { kind: 'seen', uid, etag }
}

/** The change a proposal makes in the plan: a session deleted in Google goes to the trash. */
export const changeOf = (proposal: Proposal): PlanChange =>
  proposal.change ?? { type: 'event.remove', uid: proposal.uid }

/** Why an edit made in Google waits for the person: the planner changed that event too, or the plan cannot take it. */
export type Hold = 'both' | 'misfit'

/**
 * Whether the planner changed, since `written` went to Google, what `change` changes there too: then only the person
 * knows which one stands. `now` is the event as the plan would write it now.
 */
function clashes(change: PlanChange | null, written: GoogleRow, now: GoogleRow): boolean {
  const moved = now.start !== written.start || now.end !== written.end
  if (change?.type === 'events.done') return marked(now.summary) !== marked(written.summary)
  if (change?.type === 'event.detach') return moved
  if (change?.type !== 'event.patch') return now.hash !== written.hash
  const { title, start, end, skip } = change.patch ?? {}
  const retitled = title !== undefined && plain(now.summary) !== plain(written.summary)
  return retitled || (moved && (start ?? end ?? skip) !== undefined)
}

/**
 * Which edits read from Google go into the plan now. An edit there is the person's own decision, so it is taken like
 * one made in the planner, Undo being the way back. Two kinds wait for them instead: an edit to something the planner
 * changed too since it was last written to Google, and one the plan cannot take. The edits of one Google event are
 * taken or held together.
 */
export function triage(
  plan: Plan,
  state: GoogleState,
  proposals: Proposal[],
): { take: Proposal[]; hold: (Proposal & { hold: Hold })[] } {
  const take: Proposal[] = []
  const hold: (Proposal & { hold: Hold })[] = []
  for (const source of new Set(proposals.map((p) => p.source))) {
    const group = proposals.filter((p) => p.source === source)
    const [first] = group
    const event = plan.events.find((e) => e.uid === first?.uid)
    const written = first && state.events[first.uid]
    const now = event && written && rowOf(googleBody(event, plan.meta.timezone), written.calendar, written.etag)
    const both = !now || !written || group.some((p) => clashes(p.change, written, now))
    const changes = [...take, ...group].map(changeOf)
    const why: Hold | null = both ? 'both' : previewUpdate(plan, changes).problem ? 'misfit' : null
    if (why) hold.push(...group.map((p) => ({ ...p, hold: why })))
    else take.push(...group)
  }
  return { take, hold }
}

/** An edit waiting for the person, with an id to accept or reject it by. */
export interface InboxItem extends Proposal {
  id: string
  /** Why it was not taken; absent on items filed before edits were taken */
  hold?: Hold | undefined
}

/** The Google part of `data/sync.json`. */
export interface GoogleSync extends GoogleState {
  inbox: InboxItem[]
  /** When the last round ended, UTC epoch ms */
  lastRound?: number | undefined
  /** When an edit made in Google was last taken into the plan, UTC epoch ms */
  takenAt?: number | undefined
  /** Why the last round failed: `reconnect` when Google no longer takes the app's sign-in */
  error?: string | undefined
}

/** The inbox with what one Google event proposes now in place of what it proposed before. */
export const fileProposals = (
  inbox: InboxItem[],
  source: string,
  proposals: (Proposal & { hold?: Hold | undefined })[],
): InboxItem[] => [
  ...inbox.filter((item) => item.source !== source),
  ...proposals.map((p) => ({ ...p, id: hashText(JSON.stringify([p.source, p.etag, p.change])) })),
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown) => (typeof value === 'string' ? value : '')

function entries<T>(value: unknown, parse: (record: Record<string, unknown>) => T): Record<string, T> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, v]): [string, T][] => (isRecord(v) ? [[key, parse(v)]] : [])),
  )
}

function parseItem(value: unknown): InboxItem[] {
  if (!isRecord(value)) return []
  const { id, uid, source, day, etag, basis, hold } = value
  if (typeof id !== 'string' || typeof uid !== 'string' || typeof source !== 'string') return []
  if (typeof etag !== 'string' || typeof basis !== 'string') return []
  try {
    const change = value.change === null ? null : parseChange(value.change)
    const why = hold === 'both' || hold === 'misfit' ? hold : undefined
    return [{ id, uid, source, day: typeof day === 'string' ? day : undefined, change, etag, basis, hold: why }]
  } catch {
    return []
  }
}

/** The Google sync state read from a file; what is not part of it is left out. */
export function parseGoogleSync(value: unknown): GoogleSync {
  const record = isRecord(value) ? value : {}
  const calendars = entries(record.calendars, (row) => ({
    id: text(row.id),
    summary: text(row.summary),
    syncToken: typeof row.syncToken === 'string' ? row.syncToken : undefined,
  }))
  const events = entries(record.events, (row) => ({
    calendar: text(row.calendar),
    etag: text(row.etag),
    hash: text(row.hash),
    summary: text(row.summary),
    start: text(row.start),
    end: text(row.end),
  }))
  return {
    calendars: Object.fromEntries(Object.entries(calendars).filter(([, row]) => row.id)),
    events: Object.fromEntries(Object.entries(events).filter(([, row]) => row.calendar)),
    inbox: Array.isArray(record.inbox) ? record.inbox.flatMap(parseItem) : [],
    lastRound: typeof record.lastRound === 'number' ? record.lastRound : undefined,
    takenAt: typeof record.takenAt === 'number' ? record.takenAt : undefined,
    error: typeof record.error === 'string' ? record.error : undefined,
  }
}
