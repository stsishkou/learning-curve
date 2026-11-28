// How the plan looks in Outlook through Microsoft Graph: the event a plan event becomes there, and what one full read
// of a calendar says in the terms of `calendar-sync.ts`. Graph has no id the app can choose and no list of what
// changed in a calendar other than the main one, so the app keeps the id of each event and reads its calendars whole:
// an event that is gone was deleted, a repeat that is gone was cancelled.
import { DAY, parseLocal, startOfDay, toLocalString, toMinsk, weekday, ymd } from '../core/dates'
import { weekdaysOf } from '../core/recurrence'
import type { Plan } from '../core/types'
import { writtenHash, writtenOf, type RemoteEvent, type SyncState, type Written } from './calendar-sync'

/** What the app asks Microsoft for: a refresh token, and the person's calendars, the narrowest Graph offers */
export const OUTLOOK_SCOPES = ['offline_access', 'https://graph.microsoft.com/Calendars.ReadWrite']

// Graph documents Windows zone names; IANA ones are accepted for only some zones.
const WINDOWS_ZONES: Record<string, string> = {
  'Europe/Minsk': 'Belarus Standard Time',
  'Europe/Moscow': 'Russian Standard Time',
  'Europe/Kaliningrad': 'Kaliningrad Standard Time',
  'Europe/Warsaw': 'Central European Standard Time',
  'Europe/Berlin': 'W. Europe Standard Time',
  'Europe/London': 'GMT Standard Time',
  UTC: 'UTC',
}

/** The name Graph takes for the plan's time zone. */
export const outlookZone = (timeZone: string) => WINDOWS_ZONES[timeZone] ?? timeZone

export interface GraphTime {
  dateTime: string
  timeZone: string
}

export interface GraphRecurrence {
  pattern: { type: 'weekly'; interval: number; daysOfWeek: string[]; firstDayOfWeek: 'monday' }
  range:
    | { type: 'noEnd'; startDate: string }
    | { type: 'endDate'; startDate: string; endDate: string }
    | { type: 'numbered'; startDate: string; numberOfOccurrences: number }
}

/** An Outlook event as Graph returns it: the fields the sync reads. */
export interface GraphEvent {
  id: string
  changeKey?: string | undefined
  subject?: string | undefined
  start?: GraphTime | undefined
  end?: GraphTime | undefined
  isAllDay?: boolean | undefined
  isCancelled?: boolean | undefined
  /** `singleInstance`, `occurrence`, `exception` or `seriesMaster` */
  type?: string | undefined
  seriesMasterId?: string | null | undefined
  /** Where a repeat was before it was changed, in UTC */
  originalStart?: string | null | undefined
}

/** What the app writes to an Outlook event: the fields it owns. */
export interface GraphBody {
  subject: string
  body: { contentType: 'text'; content: string }
  start: GraphTime
  end: GraphTime
  isAllDay: boolean
  showAs: 'free' | 'busy'
  recurrence: GraphRecurrence | null
}

const DAY_NAMES: Record<string, string> = {
  MO: 'monday',
  TU: 'tuesday',
  WE: 'wednesday',
  TH: 'thursday',
  FR: 'friday',
  SA: 'saturday',
  SU: 'sunday',
}
const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** A weekly rule of the plan as Graph's recurrence, from `startDay`. */
export function outlookRecurrence(rule: string, startDay: string): GraphRecurrence {
  const parts = new Map(
    rule.split(';').map((part): [string, string] => [part.split('=')[0] ?? '', part.slice(part.indexOf('=') + 1)]),
  )
  const named = (parts.get('BYDAY') ?? '').split(',').flatMap((code) => DAY_NAMES[code] ?? [])
  const daysOfWeek = named.length ? named : [WEEKDAY_NAMES[weekday(parseLocal(startDay))] ?? 'monday']
  const until = parts.get('UNTIL')
  const count = Number(parts.get('COUNT'))
  return {
    pattern: {
      type: 'weekly',
      interval: Number(parts.get('INTERVAL') ?? 1) || 1,
      daysOfWeek,
      firstDayOfWeek: 'monday',
    },
    range: until
      ? {
          type: 'endDate',
          startDate: startDay,
          endDate: `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`,
        }
      : count > 0
        ? { type: 'numbered', startDate: startDay, numberOfOccurrences: count }
        : { type: 'noEnd', startDate: startDay },
  }
}

const graphTime = (wall: string, zone: string): GraphTime => ({
  dateTime: `${wall.length === 10 ? `${wall}T00:00` : wall}:00`,
  timeZone: zone,
})

/** A plan event as it is written to Outlook. Days a repeat skips are cancelled one by one after it is written. */
export function outlookBody(written: Written, timeZone: string): GraphBody {
  const zone = outlookZone(timeZone)
  return {
    subject: written.summary,
    body: { contentType: 'text', content: written.description },
    start: graphTime(written.start, zone),
    end: graphTime(written.end, zone),
    isAllDay: written.allDay,
    showAs: written.free ? 'free' : 'busy',
    recurrence: written.repeat ? outlookRecurrence(written.repeat.rule, written.start.slice(0, 10)) : null,
  }
}

const UTC_NAMES = new Set(['UTC', 'Etc/UTC', 'Coordinated Universal Time'])

/** A Graph time as a plan wall-clock string; a whole day as `YYYY-MM-DD`. */
export function outlookWall(time: GraphTime | undefined, allDay: boolean): string | null {
  if (!time?.dateTime) return null
  const at = time.dateTime.slice(0, 19)
  // The app asks for the plan's zone; a time in UTC is one Graph gave without it.
  const wall = UTC_NAMES.has(time.timeZone) ? toLocalString(toMinsk(Date.parse(`${at}Z`))) : at.slice(0, 16)
  return allDay ? wall.slice(0, 10) : wall
}

/** The plan day of a repeat from its `originalStart`, which Graph gives in UTC. */
const dayOf = (originalStart: string) => {
  const instant = Date.parse(originalStart.endsWith('Z') ? originalStart : `${originalStart.slice(0, 19)}Z`)
  return Number.isNaN(instant) ? undefined : ymd(toMinsk(instant))
}

/** An event read from Outlook; `uidOf` knows which plan event an Outlook id was written for. */
export function remoteOfOutlook(item: GraphEvent, uidOf: (id: string) => string | null): RemoteEvent {
  const master = item.seriesMasterId ?? null
  const allDay = item.isAllDay === true
  return {
    id: item.id,
    uid: uidOf(master ?? item.id),
    etag: item.changeKey ?? '',
    cancelled: item.isCancelled === true,
    summary: item.subject ?? '',
    start: outlookWall(item.start, allDay),
    end: outlookWall(item.end, allDay),
    day: master && item.originalStart ? dayOf(item.originalStart) : undefined,
  }
}

/** Repeats are read back for this many days before today and after it. */
const BEFORE = 60
const AFTER = 365

/** The days around `now` (UTC epoch ms) whose repeats a read of a calendar compares with the plan. */
export function repeatWindow(now: number): { from: string; to: string } {
  const today = startOfDay(toMinsk(now))
  return { from: ymd(today - BEFORE * DAY), to: ymd(today + AFTER * DAY) }
}

/** A synthetic id for a repeat that is gone from Outlook, which has no id of its own any more. */
export const goneRepeatId = (series: string, day: string) => `${series}#${day}`
export const isGoneRepeat = (id: string) => id.includes('#')

/** The days in `from`–`to` the plan has a repeat of `uid` on. */
function plannedDays(plan: Plan, uid: string, from: string, to: string): string[] {
  const event = plan.events.find((e) => e.uid === uid)
  if (!event?.rrule) return []
  const days = new Set(weekdaysOf(event.rrule))
  const first = Math.max(parseLocal(from), startOfDay(parseLocal(event.start)))
  const out: string[] = []
  for (let d = first; d < parseLocal(to); d += DAY) {
    if (days.has(weekday(d)) && !event.skip?.includes(ymd(d))) out.push(ymd(d))
  }
  return out
}

/**
 * What one full read of an Outlook calendar says: `events` its single events and series, `repeats` the repeats of its
 * series between `from` and `to`. A session the app wrote that is not there any more was deleted; a repeat missing
 * from a series that still has others was cancelled. Repeats of a series the plan changed since it was written are not compared: the plan's
 * new version is about to replace them.
 */
export function readOutlookCalendar(
  read: { events: GraphEvent[]; repeats: GraphEvent[]; from: string; to: string },
  calendar: string,
  plan: Plan,
  state: SyncState,
): RemoteEvent[] {
  const rows = Object.entries(state.events).filter(([, row]) => row.calendar === calendar)
  const uids = new Map(rows.map(([uid, row]) => [row.id, uid]))
  const uidOf = (id: string) => uids.get(id) ?? null
  const current = (uid: string) => {
    const event = plan.events.find((e) => e.uid === uid)
    return event !== undefined && state.events[uid]?.hash === writtenHash(writtenOf(event))
  }
  const out = read.events.map((item) => remoteOfOutlook(item, uidOf))
  const seen = new Set(read.events.map((item) => item.id))
  for (const [uid, row] of rows) {
    if (!seen.has(row.id)) out.push({ id: row.id, uid, etag: '', cancelled: true, summary: '', start: null, end: null })
  }
  const present = new Map<string, Set<string>>()
  for (const item of read.repeats) {
    const repeat = remoteOfOutlook(item, uidOf)
    if (!repeat.uid || repeat.day === undefined || !current(repeat.uid)) continue
    out.push(repeat)
    present.set(repeat.uid, (present.get(repeat.uid) ?? new Set<string>()).add(repeat.day))
  }
  for (const [uid, row] of rows) {
    // A series with no repeat read at all was not read, rather than cancelled day by day.
    const days = present.get(uid)
    if (!seen.has(row.id) || !days) continue
    for (const day of plannedDays(plan, uid, read.from, read.to)) {
      if (days.has(day)) continue
      out.push({
        id: goneRepeatId(row.id, day),
        uid,
        etag: '',
        cancelled: true,
        summary: '',
        start: null,
        end: null,
        day,
      })
    }
  }
  return out
}
