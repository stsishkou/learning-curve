// Node-only: reads the person's own calendar from its iCal address, to show its busy time behind the plan.
import { toMinsk, type BusyBlock } from '@lc/plan-domain'
import ICAL from 'ical.js'

const MINSK_OFFSET = toMinsk(0)
/** How long a fetched calendar is reused: calendar hosts ask not to be polled more often than every few minutes */
const KEEP_FOR = 10 * 60_000
const TIMEOUT = 10_000
const MAX_BYTES = 5_000_000
/** Repeats of one event read before giving up: a guard against a rule that never ends */
const MAX_REPEATS = 5000

/**
 * The address as it is fetched: `webcal:` is the same file over https. null when it is not an https address, which
 * is what every calendar host gives out.
 */
export function feedAddress(input: string): string | null {
  try {
    const url = new URL(input.trim().replace(/^webcal:/i, 'https:'))
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

const wallClock = (time: ICAL.Time) =>
  // A date without a time is the same day everywhere; a moment is shown on the plan's Minsk clock.
  time.isDate ? Date.UTC(time.year, time.month - 1, time.day) : toMinsk(time.toJSDate().getTime())

/**
 * The busy time of an iCalendar file between two Minsk wall-clock moments. Repeats are expanded with their
 * exceptions; events marked free (`TRANSP:TRANSPARENT`) or cancelled are left out, since they take no time.
 */
export function parseBusy(text: string, from: number, to: number): BusyBlock[] {
  const root = new ICAL.Component(ICAL.parse(text))
  for (const zone of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(zone)
  const events = root.getAllSubcomponents('vevent').map((component) => new ICAL.Event(component))
  const blocks: BusyBlock[] = []

  const add = (event: ICAL.Event, start: ICAL.Time, end: ICAL.Time) => {
    const component = event.component
    if (component.getFirstPropertyValue('transp') === 'TRANSPARENT') return
    if (component.getFirstPropertyValue('status') === 'CANCELLED') return
    const s = wallClock(start)
    const e = wallClock(end)
    if (s < to && e > from && e > s)
      blocks.push({ title: event.summary || '', s, e, ...(start.isDate ? { allDay: true } : {}) })
  }

  for (const event of events) {
    // A changed repeat is read through its series, below.
    if (event.isRecurrenceException()) continue
    if (!event.isRecurring()) {
      add(event, event.startDate, event.endDate)
      continue
    }
    for (const other of events) {
      if (other.isRecurrenceException() && other.uid === event.uid) event.relateException(other)
    }
    const repeats = event.iterator()
    for (let count = 0; count < MAX_REPEATS; count++) {
      const next = repeats.next()
      if (!next) break
      const occurrence = event.getOccurrenceDetails(next)
      // Read against the real clock: the window's end as an instant, with a day of slack for all-day repeats.
      if (occurrence.startDate.toJSDate().getTime() > to - MINSK_OFFSET + 86_400_000) break
      add(occurrence.item, occurrence.startDate, occurrence.endDate)
    }
  }
  return blocks.toSorted((a, b) => a.s - b.s)
}

let kept: { url: string; text: string; at: number } | null = null

/** Fetches the calendar at `url` (reusing it for ten minutes) and returns its busy time in the window. */
export async function loadBusy(url: string, from: number, to: number, fresh = false): Promise<BusyBlock[]> {
  if (fresh || kept?.url !== url || Date.now() - kept.at > KEEP_FOR) {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), redirect: 'follow' })
    if (!response.ok) throw new Error(`The calendar answered ${response.status}`)
    const text = await response.text()
    if (text.length > MAX_BYTES) throw new Error('The calendar file is too large')
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('The address did not return a calendar file')
    kept = { url, text, at: Date.now() }
  }
  return parseBusy(kept.text, from, to)
}
