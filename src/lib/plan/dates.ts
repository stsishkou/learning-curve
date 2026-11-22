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
export const addDays = (s: string, n: number) => ymd(parseLocal(s) + n * DAY)

/** Current Minsk wall-clock time */
export const nowMinsk = () => Date.now() + MINSK_OFFSET
