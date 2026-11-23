import { toMinsk, zoneShift } from '@lc/plan-domain'

/** One time zone as the picker lists it. */
export interface ZoneOption {
  /** IANA name, `Europe/Warsaw` */
  id: string
  /** The city the zone is named after, `Warsaw` */
  city: string
  /** What the clock there shows more than the plan's clock, in ms; negative when it is behind */
  shift: number
  /** Everything the search looks in, lower case */
  haystack: string
}

/** Offered before anything is typed: zones people most often work across. */
const COMMON = [
  'UTC',
  'Europe/London',
  'Europe/Warsaw',
  'Europe/Berlin',
  'Europe/Kyiv',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
]

export const cityOf = (zone: string) => zone.split('/').at(-1)!.replaceAll('_', ' ')

/** `utc+1 gmt+1 +1 +01:00`: the ways people type an offset. */
function offsetWords(shift: number): string {
  // The plan's clock is three hours ahead of UTC all year.
  const minutes = Math.round((shift + toMinsk(0)) / 60_000)
  const sign = minutes < 0 ? '-' : '+'
  const hours = Math.floor(Math.abs(minutes) / 60)
  const rest = Math.abs(minutes) % 60
  const short = rest ? `${hours}:${String(rest).padStart(2, '0')}` : `${hours}`
  return `utc${sign}${short} gmt${sign}${short} ${sign}${short} ${sign}${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/**
 * Every zone the browser knows, with how its clock differs from the plan's at `now` (Minsk wall-clock ms).
 * `regionOf` gives the name of a zone in the person's language, so "Польша" finds Warsaw.
 */
export function listZones(now: number, regionOf: (zone: string) => string): ZoneOption[] {
  const ids = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : COMMON
  return [...new Set(['UTC', ...ids])].flatMap((id) => {
    const shift = zoneShift(id, now)
    if (shift === null) return []
    const city = cityOf(id)
    const haystack = `${city} ${id.replaceAll('_', ' ')} ${regionOf(id)} ${offsetWords(shift)}`.toLocaleLowerCase()
    return [{ id, city, shift, haystack }]
  })
}

/** The zones that match every word of the query; without a query, the person's own zone and the common ones. */
export function findZones(zones: ZoneOption[], query: string, mine: string, limit = 40): ZoneOption[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) {
    const first = [mine, ...COMMON.filter((id) => id !== mine)]
    return first.flatMap((id) => zones.find((zone) => zone.id === id) ?? [])
  }
  return zones
    .filter((zone) => words.every((word) => zone.haystack.includes(word)))
    .toSorted(
      (a, b) =>
        Number(b.city.toLocaleLowerCase().startsWith(words[0])) -
        Number(a.city.toLocaleLowerCase().startsWith(words[0])),
    )
    .slice(0, limit)
}
