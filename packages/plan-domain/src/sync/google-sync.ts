// How the plan looks in Google Calendar: the event a plan event becomes there, and what an event read from Google
// says in the terms of `calendar-sync.ts`.
import { toLocalString, toMinsk } from '../core/dates'
import type { RemoteEvent, Written } from './calendar-sync'

/** What the app asks Google for: the calendars it makes and their events, nothing else in the account */
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'

const BASE32HEX = '0123456789abcdefghijklmnopqrstuv'

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
  transparency: 'opaque' | 'transparent'
  extendedProperties: { private: { lcUid: string } }
}

/** A plan wall-clock string as a Google time on the plan's clock. */
export const googleTime = (wall: string, timeZone: string): GoogleTime =>
  wall.length === 10 ? { date: wall } : { dateTime: `${wall}:00`, timeZone }

/** The plan event `uid` as it is written to Google. */
export function googleBody(uid: string, written: Written, timeZone: string): GoogleBody {
  const body: GoogleBody = {
    id: googleEventId(uid),
    summary: written.summary,
    description: written.description,
    start: googleTime(written.start, timeZone),
    end: googleTime(written.end, timeZone),
    transparency: written.free ? 'transparent' : 'opaque',
    extendedProperties: { private: { lcUid: uid } },
  }
  if (written.repeat) {
    const at = written.start.slice(11, 16).replace(':', '')
    body.recurrence = [
      `RRULE:${written.repeat.rule}`,
      ...written.repeat.skip.map((day) => `EXDATE;TZID=${timeZone}:${day.replaceAll('-', '')}T${at}00`),
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

/** An event read from Google; null for one repeat whose day Google did not give. */
export function remoteOfGoogle(item: GoogleEvent): RemoteEvent | null {
  const repeat = item.recurringEventId !== undefined
  const day = repeat ? wallOf(item.originalStartTime)?.slice(0, 10) : undefined
  if (repeat && !day) return null
  return {
    id: item.id,
    uid: item.extendedProperties?.private?.lcUid ?? uidOfGoogleId(item.recurringEventId ?? item.id),
    etag: item.etag ?? '',
    cancelled: item.status === 'cancelled',
    summary: item.summary ?? '',
    start: wallOf(item.start),
    end: wallOf(item.end),
    day,
  }
}
