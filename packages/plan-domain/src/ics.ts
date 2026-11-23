import { parseLocal } from './dates'
import { hashText, type Revisions } from './revisions'
import type { Plan, PlanCalendar, PlanEvent } from './types'

const escapeText = (s: string) =>
  s.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replaceAll(/\r?\n/g, '\\n')

/** Lines longer than 75 octets are folded with CRLF + space (RFC 5545 §3.1). */
function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ch
    } else cur += ch
  }
  out.push(cur)
  return out.join('\r\n ')
}

/** A moment as an iCalendar UTC date-time, `20261123T094000Z` */
const utc = (ms: number) => new Date(ms).toISOString().replaceAll(/[-:]/g, '').replace(/\.\d+/, '')

/** A length in minutes as `1:15` */
const clock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, '0')}`

const compact = (local: string) => local.replaceAll(/[-:]/g, '').slice(0, 15).padEnd(15, '0') // 2026-11-23T12:00 → 20261123T120000

function nextDate(day: string): string {
  const d = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)) + 1))
  return d.toISOString().slice(0, 10).replaceAll('-', '')
}

const fileStem = (name: string) =>
  name
    .replaceAll(/[:/\\]/g, '')
    .trim()
    .replaceAll(/\s+/g, '_')

/** File name used for downloads and the zip, e.g. `Gemini_Certs.ics` */
export const icsFileName = (calendar: PlanCalendar) => `${fileStem(calendar.name)}.ics`

/** File name of the plan itself when it is downloaded: it follows the plan's title, e.g. `AI_Agent_Engineer.json` */
export const planFileName = (plan: Plan) => `${fileStem(plan.meta.title) || 'plan'}.json`

/** Minutes before a start that the viewer's own reminders and the exported alarms use */
export const ALARM_MINUTES = 10

export interface IcsOptions {
  /** Done sessions get a ✓ before the title and stop blocking their time: a VEVENT has no "completed" state */
  markDone?: boolean
  /**
   * Minutes before the start at which every timed, busy event that is not finished asks for a reminder (VALARM).
   * Whether it is kept is up to the calendar app: some replace it with their own default.
   */
  alarm?: number | undefined
  /** The address the file is served from, for a client that subscribed to it (RFC 7986 SOURCE) */
  source?: string
  /** Versions of the events, written as `SEQUENCE` and `LAST-MODIFIED`: a refreshed feed then says which copy is newer */
  revisions?: Revisions
}

/**
 * One VCALENDAR per target calendar. Google Calendar and Outlook import it into the calendar the user picks.
 * The fixed Europe/Minsk VTIMEZONE (+03:00, no DST) keeps times correct in both.
 */
export function buildICS(calendar: PlanCalendar, events: PlanEvent[], tz: string, options: IcsOptions = {}): string {
  const stamp = utc(Date.now())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//learning-curve//study plan//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // The name and the refresh hint twice: RFC 7986 has the standard properties, older clients read the X- ones.
    `NAME:${escapeText(calendar.name)}`,
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    `X-WR-TIMEZONE:${tz}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...(/^#[0-9a-f]{6}$/i.test(calendar.color) ? [`X-APPLE-CALENDAR-COLOR:${calendar.color}`] : []),
    ...(options.source ? [`SOURCE;VALUE=URI:${options.source}`] : []),
    'BEGIN:VTIMEZONE',
    `TZID:${tz}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0300',
    'TZOFFSETTO:+0300',
    'TZNAME:+03',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`)
    const revision = options.revisions?.[e.uid]
    if (revision) lines.push(`SEQUENCE:${revision.seq}`, `LAST-MODIFIED:${utc(revision.modified)}`)
    if (e.allDay) {
      const day = e.start.slice(0, 10).replaceAll('-', '')
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDate(day)}`)
    } else {
      lines.push(`DTSTART;TZID=${tz}:${compact(e.start)}`, `DTEND;TZID=${tz}:${compact(e.end)}`)
    }
    if (e.rrule) lines.push(`RRULE:${e.rrule}`)
    for (const day of e.skip ?? []) lines.push(`EXDATE;TZID=${tz}:${compact(`${day}T${e.start.slice(11, 16)}`)}`)
    const finished = options.markDone === true && e.done === true
    lines.push(`SUMMARY:${escapeText(finished ? `✓ ${e.title}` : e.title)}`)
    // How long it really took, first: the calendar shows only the planned slot.
    const took =
      finished && e.actual && !e.allDay
        ? `✓ ${clock(e.actual)} / ${clock((parseLocal(e.end) - parseLocal(e.start)) / 60_000)}`
        : ''
    const description = [took, e.description].filter(Boolean).join('\n\n')
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`)
    const url = e.description.match(/Module: (\S+)/)?.[1]
    if (url && /^https?:/.test(url)) lines.push(`URL:${url}`)
    lines.push(`TRANSP:${e.availability === 'free' || finished ? 'TRANSPARENT' : 'OPAQUE'}`, 'STATUS:CONFIRMED')
    if (options.alarm && !e.allDay && e.availability !== 'free' && !e.done) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(e.title)}`,
        `TRIGGER:-PT${options.alarm}M`,
        'END:VALARM',
      )
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}

/** Events of one calendar, ready for `buildICS`. */
export const calendarICS = (plan: Plan, calendar: PlanCalendar, options?: IcsOptions) =>
  buildICS(
    calendar,
    plan.events.filter((e) => e.calendar === calendar.id),
    plan.meta.timezone,
    options,
  )

/** The stand-in calendar for a combined export: every chosen calendar's events in one file. */
export const combinedCalendar = (plan: Plan): PlanCalendar => ({
  id: 'all',
  name: plan.meta.title,
  color: '',
  isNew: true,
})

/** One VCALENDAR with the events of all `calendarIds`, for import into a single calendar. */
export const combinedICS = (plan: Plan, calendarIds: ReadonlySet<string>, options?: IcsOptions) =>
  buildICS(
    combinedCalendar(plan),
    plan.events.filter((e) => calendarIds.has(e.calendar)),
    plan.meta.timezone,
    options,
  )

export const IMPORT_HOWTO = (newCalendars: string[]) =>
  [
    'Каждый .ics-файл импортируется в календарь с тем же названием.',
    '',
    'Google Calendar (компьютер): Настройки → Импорт и экспорт → Импорт → выбрать файл → выбрать календарь → Импорт.',
    'Outlook: Календарь → Добавить календарь → Загрузить из файла → выбрать файл и календарь.',
    'Календарь Apple: открыть файл (на Mac: Файл → Импортировать) и выбрать календарь.',
    '',
    newCalendars.length ? `Новые календари (создать заранее): ${newCalendars.join(', ')}.` : '',
    'Перед повторным импортом удалите старые события из этих календарей, иначе появятся дубли.',
  ]
    .filter((l, i, a) => l || a[i - 1])
    .join('\r\n')

/**
 * A validator of an .ics file for HTTP: two files with the same events get the same one, although each says when it
 * was written (`DTSTAMP`). Weak, as a byte-for-byte match is not promised.
 */
export const icsETag = (ics: string) => `W/"${hashText(ics.replaceAll(/^DTSTAMP:.*\r\n/gm, ''))}"`
