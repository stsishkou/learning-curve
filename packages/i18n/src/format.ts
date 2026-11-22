// Locale-aware text for plan times. The values are UTC-naive wall-clock ms (see @lc/plan-domain dates),
// hence `timeZone: 'UTC'` everywhere.
import { m } from './paraglide/messages.js'
import { getLocale } from './paraglide/runtime.js'

type Style = 'day' | 'short' | 'weekday'

const OPTIONS: Record<Style, Intl.DateTimeFormatOptions> = {
  day: { weekday: 'short', day: 'numeric', month: 'short' },
  short: { day: 'numeric', month: 'short' },
  weekday: { weekday: 'short' },
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function format(style: Style, t: number): string {
  const locale = getLocale()
  const key = `${locale}:${style}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...OPTIONS[style], timeZone: 'UTC' })
    formatters.set(key, formatter)
  }
  // Abbreviations carry a dot in ru and es ("нояб.", "lun."), which reads as a full stop mid-sentence.
  const text = formatter.format(t).replaceAll('.', '')
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)
}

/** `Пн, 23 нояб` / `Mon, Nov 23` / `Lun, 23 nov` */
export const fmtDay = (t: number) => format('day', t)
/** `23 нояб` / `Nov 23` / `23 nov` */
export const fmtShort = (t: number) => format('short', t)
export const dowShort = (t: number) => format('weekday', t)

export const fmtHours = (h: number) =>
  m.hours_short({ value: new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(h) })
