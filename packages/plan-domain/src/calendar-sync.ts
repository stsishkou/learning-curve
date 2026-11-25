// What keeping the plan in a calendar app means, whichever app it is: what an event says there, what has to be sent
// after a change, and what a person's edit there means for the plan. Each app's own format is in its module
// (`google-sync.ts`, `outlook-sync.ts`). The plan stays the source of truth: an edit made in a calendar app reaches it
// as a change, like one made in the planner, and Undo takes it back.
import { parseChange, type PlanChange } from './changes'
import { DAY, parseLocal, toLocalString, ymd } from './dates'
import type { EventPatch } from './edits'
import { tookNote } from './ics'
import { skipDay } from './occurrence-changes'
import { isDone } from './progress'
import { hashText } from './revisions'
import type { Plan, PlanCalendar, PlanEvent } from './types'
import { previewUpdate } from './update'

/** The calendar apps the plan can be kept in. */
export const CALENDAR_PROVIDERS = ['google', 'outlook'] as const
export type CalendarProvider = (typeof CALENDAR_PROVIDERS)[number]

export const isCalendarProvider = (value: unknown): value is CalendarProvider =>
  CALENDAR_PROVIDERS.some((provider) => provider === value)

const DONE = '✓ '

/** One plan event as every calendar app is given it, before the app's own format. */
export interface Written {
  /** The title, with ✓ before it once the session is done */
  summary: string
  /** How long a done session took, then the event's notes */
  description: string
  /** `YYYY-MM-DDTHH:MM`, or `YYYY-MM-DD` for a whole day */
  start: string
  /** For a whole day, the day after it */
  end: string
  allDay: boolean
  /** A done session no longer blocks its time, as a free event never did */
  free: boolean
  /** For a repeating event: its weekly rule and the days it skips */
  repeat?: { rule: string; skip: string[] } | undefined
}

export function writtenOf(event: PlanEvent): Written {
  const done = event.done === true
  const day = event.start.slice(0, 10)
  const written: Written = {
    summary: isDone(event) ? `${DONE}${event.title}` : event.title,
    description: [tookNote(event), event.description].filter(Boolean).join('\n\n'),
    start: event.allDay ? day : event.start,
    end: event.allDay ? ymd(parseLocal(day) + DAY) : event.end,
    allDay: event.allDay === true,
    free: done || event.availability === 'free',
  }
  if (event.rrule) written.repeat = { rule: event.rrule, skip: event.skip ?? [] }
  return written
}

export const writtenHash = (written: Written) => hashText(JSON.stringify(written))

/** What the app last wrote to one event in a calendar app, or accepted from it. */
export interface SyncRow {
  /** The app's calendar it is in */
  calendar: string
  /** The app's id of the event */
  id: string
  /** The app's version of the event (an etag, a change key) as it was last seen */
  etag: string
  /** `writtenHash` of what was written; empty to have it written again */
  hash: string
  /** Its title and times as written, to tell what a person changed there */
  summary: string
  start: string
  end: string
}

export interface SyncCalendarRow {
  id: string
  summary: string
  /** Where the last read of its events ended, for an app that reads changes only; absent before the first read */
  cursor?: string | undefined
}

/** What is kept between two rounds of a sync, by plan calendar id and by event uid. */
export interface SyncState {
  calendars: Record<string, SyncCalendarRow>
  events: Record<string, SyncRow>
}

/** The row for `written`, just stored by the app as event `id` at version `etag`. */
export const rowOf = (written: Written, calendar: string, id: string, etag: string): SyncRow => ({
  calendar,
  id,
  etag,
  hash: writtenHash(written),
  summary: written.summary,
  start: written.start,
  end: written.end,
})

export interface PushPlan {
  /** Plan calendars that have no calendar in the app yet; their events wait for the next round */
  create: PlanCalendar[]
  rename: { id: string; summary: string }[]
  insert: { uid: string; calendar: string; written: Written }[]
  /** Moved to another calendar first, then patched when what is written differs */
  move: { uid: string; to: string; written: Written }[]
  patch: { uid: string; written: Written }[]
  remove: { uid: string; row: SyncRow }[]
  /** Plan calendars that are gone: their calendar in the app is deleted once its events are */
  drop: string[]
}

/**
 * What has to be written to a calendar app for it to show `plan`, worked out from state rather than from the edits
 * that led there: an edit, an undo, `pnpm run plan` and a change made by a model all reach it the same way. Events
 * with an edit waiting for a decision (`frozen`) are left as they are there until the person decides.
 */
export function planPush(plan: Plan, state: SyncState, frozen: ReadonlySet<string> = new Set()): PushPlan {
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
    const written = writtenOf(event)
    const row = state.events[event.uid]
    if (!row) {
      out.insert.push({ uid: event.uid, calendar, written })
      continue
    }
    if (row.calendar !== calendar) out.move.push({ uid: event.uid, to: calendar, written })
    if (row.hash !== writtenHash(written)) out.patch.push({ uid: event.uid, written })
  }
  for (const [uid, row] of Object.entries(state.events)) {
    if (!kept.has(uid) && !frozen.has(uid)) out.remove.push({ uid, row })
  }
  const calendars = new Set(plan.calendars.map((c) => c.id))
  out.drop = Object.keys(state.calendars).filter((id) => !calendars.has(id))
  return out
}

/** An event read from a calendar app, in the app's terms no more. */
export interface RemoteEvent {
  /** The app's id of what was read: the event, or one repeat of a series */
  id: string
  /** The plan event it shows; null for one made in the app */
  uid: string | null
  etag: string
  /** Deleted in the app */
  cancelled: boolean
  summary: string
  /** Plan wall-clock times, `YYYY-MM-DD` for a whole day; null when the app gave none */
  start: string | null
  end: string | null
  /** For one repeat of a series: the day it was on before it was changed */
  day?: string | undefined
}

/** An edit made in a calendar app, as a change to the plan. */
export interface Proposal {
  uid: string
  /** The app's event it was read from: the event itself, or one repeat of it */
  source: string
  /** The day of that repeat, when it is one */
  day?: string | undefined
  /** The change; null for a session deleted there, which goes to the trash */
  change: PlanChange | null
  /** The app's version of the event when it was read */
  etag: string
  /** `writtenHash` of the plan event when it was read: once the plan has moved on, the proposal is stale */
  basis: string
}

/** What one event read from a calendar app means for the plan. */
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

/** A plan wall-clock moment for a time read back: a whole day starts at midnight. */
const wallStart = (wall: string) => (wall.length === 10 ? `${wall}T00:00` : wall)

/**
 * What an event read from a calendar app proposes. A ✓ typed before the title marks the session done and taking it
 * away marks it not done; a single session moved there moves in the plan; one repeat moved or deleted there leaves
 * its series or is skipped; a session deleted there goes to the trash. The rest of the text belongs to the plan.
 */
export function readRemote(item: RemoteEvent, plan: Plan, state: SyncState): Reading {
  const { uid, etag } = item
  const event = uid ? plan.events.find((e) => e.uid === uid) : undefined
  const row = uid ? state.events[uid] : undefined
  if (!uid || !event || !row) return NONE
  const day = item.day
  const basis = writtenHash(writtenOf(event))
  const propose = (...changes: (PlanChange | null)[]): Reading => ({
    kind: 'proposal',
    proposals: changes.map((change) => ({ uid, source: item.id, day, change, etag, basis })),
  })

  // A repeat has its own version; the series' row is never noted from it.
  if (day !== undefined) {
    if (item.cancelled) return event.skip?.includes(day) ? NONE : propose(skipDay(event, day))
    const { start, end } = item
    const slot = `${day}T${event.start.slice(11, 16)}`
    if (!start || !end || event.allDay || start === slot) return NONE
    return propose({ type: 'event.detach', uid, day, start, end })
  }
  if (etag === row.etag) return { kind: 'seen', uid, etag }

  if (item.cancelled) return propose(null)

  const changes: PlanChange[] = []
  const { summary, start, end } = item
  if (marked(summary) !== marked(row.summary) && marked(summary) !== (event.done === true)) {
    changes.push({ type: 'events.done', uids: [uid], done: marked(summary) })
  }
  const patch: EventPatch = {}
  const title = plain(summary).trim()
  const retitled = title !== plain(row.summary)
  if (retitled && title && title !== event.title) patch.title = title
  // A series moved as a whole would need its rule rewritten: the plan's own series is written back.
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

/** The change a proposal makes in the plan: a session deleted in the app goes to the trash. */
export const changeOf = (proposal: Proposal): PlanChange =>
  proposal.change ?? { type: 'event.remove', uid: proposal.uid }

/** Why an edit made in a calendar app waits for the person: the planner changed it too, or the plan cannot take it. */
export type Hold = 'both' | 'misfit'

/**
 * Whether the planner changed, since `written` went to the app, what `change` changes there too: then only the person
 * knows which one stands. `now` is the event as the plan would write it now.
 */
function clashes(change: PlanChange | null, written: SyncRow, now: SyncRow): boolean {
  const moved = now.start !== written.start || now.end !== written.end
  if (change?.type === 'events.done') return marked(now.summary) !== marked(written.summary)
  if (change?.type === 'event.detach') return moved
  if (change?.type !== 'event.patch') return now.hash !== written.hash
  const { title, start, end, skip } = change.patch ?? {}
  const retitled = title !== undefined && plain(now.summary) !== plain(written.summary)
  return retitled || (moved && (start ?? end ?? skip) !== undefined)
}

/**
 * Which edits read from a calendar app go into the plan now. An edit there is the person's own decision, so it is
 * taken like one made in the planner, Undo being the way back. Two kinds wait for them instead: an edit to something
 * the planner changed too since it was last written there, and one the plan cannot take. The edits of one event in
 * the app are taken or held together.
 */
export function triage(
  plan: Plan,
  state: SyncState,
  proposals: Proposal[],
): { take: Proposal[]; hold: (Proposal & { hold: Hold })[] } {
  const take: Proposal[] = []
  const hold: (Proposal & { hold: Hold })[] = []
  for (const source of new Set(proposals.map((p) => p.source))) {
    const group = proposals.filter((p) => p.source === source)
    const [first] = group
    const event = plan.events.find((e) => e.uid === first?.uid)
    const written = first && state.events[first.uid]
    const now = event && written && rowOf(writtenOf(event), written.calendar, written.id, written.etag)
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

/** One calendar app's part of `data/sync.json`. */
export interface CalendarSync extends SyncState {
  inbox: InboxItem[]
  /** When the last round ended, UTC epoch ms */
  lastRound?: number | undefined
  /** When an edit made in the app was last taken into the plan, UTC epoch ms */
  takenAt?: number | undefined
  /** Why the last round failed: `reconnect` when the app no longer takes the sign-in */
  error?: string | undefined
}

/** The inbox with what one event in the app proposes now in place of what it proposed before. */
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

function entries<T>(value: unknown, parse: (record: Record<string, unknown>, key: string) => T): Record<string, T> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, v]): [string, T][] => (isRecord(v) ? [[key, parse(v, key)]] : [])),
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

/**
 * One app's sync state read from a file; what is not part of it is left out. `idOf` gives the id of an event stored
 * before rows kept it, for an app whose ids follow from the uid.
 */
export function parseCalendarSync(value: unknown, idOf: (uid: string) => string = () => ''): CalendarSync {
  const record = isRecord(value) ? value : {}
  const calendars = entries(record.calendars, (row) => {
    // Called `syncToken` while Google was the only app.
    const cursor = row.cursor ?? row.syncToken
    return { id: text(row.id), summary: text(row.summary), cursor: typeof cursor === 'string' ? cursor : undefined }
  })
  const events = entries(record.events, (row, uid) => ({
    calendar: text(row.calendar),
    id: text(row.id) || idOf(uid),
    etag: text(row.etag),
    hash: text(row.hash),
    summary: text(row.summary),
    start: text(row.start),
    end: text(row.end),
  }))
  return {
    calendars: Object.fromEntries(Object.entries(calendars).filter(([, row]) => row.id)),
    events: Object.fromEntries(Object.entries(events).filter(([, row]) => row.calendar && row.id)),
    inbox: Array.isArray(record.inbox) ? record.inbox.flatMap(parseItem) : [],
    lastRound: typeof record.lastRound === 'number' ? record.lastRound : undefined,
    takenAt: typeof record.takenAt === 'number' ? record.takenAt : undefined,
    error: typeof record.error === 'string' ? record.error : undefined,
  }
}
