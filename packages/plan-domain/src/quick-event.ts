import { DAY, HOUR, parseLocal, startOfDay, toLocalString, weekday } from './dates'

/** An event read from one typed line; times are wall-clock strings, `YYYY-MM-DDTHH:MM`. */
export interface QuickEvent {
  title: string
  start: string
  end: string
}

const MINUTE = 60_000
const DAYS_AHEAD: Record<string, number> = {
  сегодня: 0,
  today: 0,
  hoy: 0,
  завтра: 1,
  tomorrow: 1,
  mañana: 1,
  послезавтра: 2,
}
// Index is the weekday number, Sunday first, as `weekday()` counts.
const WEEKDAYS = [
  ['вс', 'воскресенье', 'sun', 'sunday', 'domingo'],
  ['пн', 'понедельник', 'mon', 'monday', 'lunes'],
  ['вт', 'вторник', 'tue', 'tuesday', 'martes'],
  ['ср', 'среда', 'среду', 'wed', 'wednesday', 'miércoles', 'miercoles'],
  ['чт', 'четверг', 'thu', 'thursday', 'jueves'],
  ['пт', 'пятница', 'пятницу', 'fri', 'friday', 'viernes'],
  ['сб', 'суббота', 'субботу', 'sat', 'saturday', 'sábado', 'sabado'],
]
/** Small words that lead to a day or a time and are not part of the title: "в 14:00", "at 14:00", "on friday" */
const LINKS = new Set(['в', 'во', 'на', 'at', 'on', 'a', 'el', 'las', '@'])
const HOUR_UNITS = /^(ч|час|часа|часов|h|hr|hrs|hour|hours|hora|horas)$/
const MINUTE_UNITS = /^(м|мин|минут|минуты|m|min|mins|minute|minutes|minuto|minutos)$/
const TIME = /^(\d{1,2}):(\d{2})$/
const RANGE = /^(\d{1,2}):(\d{2})[-–—](\d{1,2}):(\d{2})$/
const AMOUNT = /^(\d+(?:[.,]\d+)?)(\D*)$/

const clock = (hours: string, minutes: string) => {
  const value = Number(hours) * HOUR + Number(minutes) * MINUTE
  return Number(hours) < 24 && Number(minutes) < 60 ? value : null
}

function span(amount: string, unit: string): number | null {
  const value = Number(amount.replace(',', '.'))
  if (HOUR_UNITS.test(unit)) return value * HOUR
  if (MINUTE_UNITS.test(unit)) return value * MINUTE
  return null
}

/**
 * Reads "Read the paper tomorrow 14:00 1.5h" as an event: a time is required, a day (today, tomorrow, a weekday,
 * `23.11`, `2026-11-23`) and a length (`1h`, `30 min`, or an end as `14:00-15:30`) are optional. Russian, English
 * and Spanish words are known. Without a day it is today, or tomorrow when that time has passed; without a
 * length it is an hour. null when the line has no time or no title: it is then just a search.
 */
export function parseQuickEvent(text: string, now: number): QuickEvent | null {
  const words = text.trim().split(/\s+/)
  const used = new Set<number>()
  let at: number | null = null
  let length: number | null = null
  let day: number | null = null

  for (const [i, raw] of words.entries()) {
    const word = raw.toLocaleLowerCase()
    const range = RANGE.exec(word)
    const time = TIME.exec(word)
    const amount = AMOUNT.exec(word)
    const next = words[i + 1]?.toLocaleLowerCase() ?? ''
    if (used.has(i)) continue
    if (range && at === null) {
      const from = clock(range[1], range[2])
      const to = clock(range[3], range[4])
      if (from === null || to === null || to <= from) continue
      at = from
      length = to - from
    } else if (time && at === null) {
      at = clock(time[1], time[2])
      if (at === null) continue
    } else if (amount && length === null && span(amount[1], amount[2] || next) !== null) {
      length = span(amount[1], amount[2] || next)
      if (!amount[2]) used.add(i + 1)
    } else if (day === null && word in DAYS_AHEAD) {
      day = startOfDay(now) + DAYS_AHEAD[word] * DAY
    } else if (day === null && WEEKDAYS.some((names) => names.includes(word))) {
      const wanted = WEEKDAYS.findIndex((names) => names.includes(word))
      day = startOfDay(now) + ((wanted - weekday(now) + 7) % 7) * DAY
    } else if (day === null && /^\d{4}-\d{2}-\d{2}$/.test(word)) {
      day = parseLocal(word)
    } else if (day === null && /^\d{1,2}\.\d{1,2}$/.test(word)) {
      const [date, month] = word.split('.').map(Number)
      const year = new Date(now).getUTCFullYear()
      const thisYear = Date.UTC(year, month - 1, date)
      day = thisYear < startOfDay(now) ? Date.UTC(year + 1, month - 1, date) : thisYear
    } else {
      continue
    }
    used.add(i)
    for (let before = i - 1; before >= 0 && LINKS.has(words[before].toLocaleLowerCase()); before--) used.add(before)
  }

  const title = words.filter((_, i) => !used.has(i)).join(' ')
  if (at === null || !title || (length !== null && length <= 0)) return null
  // A weekday that is today, or no day at all: the next time the clock shows that hour.
  let start = (day ?? startOfDay(now)) + at
  if (start <= now && (day === null || day === startOfDay(now))) start += day === null ? DAY : 7 * DAY
  return { title, start: toLocalString(start), end: toLocalString(start + (length ?? HOUR)) }
}
