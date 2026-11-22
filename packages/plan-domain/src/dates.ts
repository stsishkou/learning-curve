// Plan times are Europe/Minsk wall-clock strings (UTC+3 all year, no DST).
// They are handled as UTC-naive millisecond values so that server and browser agree
// regardless of the machine's own time zone.

export const DAY = 86_400_000
export const HOUR = 3_600_000
const MINSK_OFFSET = 3 * HOUR

const pad = (n: number) => String(n).padStart(2, '0')

/** `2026-11-23T12:00` or `2026-11-23` → wall-clock ms */
export function parseLocal(s: string): number {
  return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +(s.slice(11, 13) || 0), +(s.slice(14, 16) || 0))
}

export const ymd = (t: number) => {
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
export const hm = (t: number) => {
  const d = new Date(t)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
export const toLocalString = (t: number) => `${ymd(t)}T${hm(t)}`

export const startOfDay = (t: number) => Math.floor(t / DAY) * DAY
export const weekday = (t: number) => new Date(t).getUTCDay() // 0 Sun … 6 Sat
export const mondayOf = (t: number) => startOfDay(t) - ((weekday(t) + 6) % 7) * DAY
/** First day of the month `t` is in, and of the month `n` months away */
export const startOfMonth = (t: number, n = 0) => {
  const d = new Date(t)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)
}
export const addDays = (s: string, n: number) => ymd(parseLocal(s) + n * DAY)

/** Current Minsk wall-clock time */
/** An instant as Minsk wall-clock ms, for the date helpers and formatters. */
export const toMinsk = (instant: number) => instant + MINSK_OFFSET
export const nowMinsk = () => toMinsk(Date.now())

/** ISO 8601 week number: week 1 is the week that holds the year's first Thursday. */
export function isoWeek(t: number): number {
  const thursday = mondayOf(t) + 3 * DAY
  const firstThursday = mondayOf(Date.UTC(new Date(thursday).getUTCFullYear(), 0, 4)) + 3 * DAY
  return 1 + Math.round((thursday - firstThursday) / (7 * DAY))
}

/**
 * What to add to a Minsk wall-clock time to read the clock of another IANA time zone at that moment, in ms.
 * null when the zone is not known here.
 */
export function zoneShift(zone: string, wall: number): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(wall - MINSK_OFFSET)
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value)
    const there = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'))
    // The formatter drops the seconds: compare whole minutes.
    return there - (wall - (wall % 60_000))
  } catch {
    return null
  }
}
