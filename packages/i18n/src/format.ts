// Locale-aware text for plan times. The values are UTC-naive wall-clock ms (see @lc/plan-domain dates),
// hence `timeZone: 'UTC'` everywhere.
import { m } from './paraglide/messages.js'
import { getLocale } from './paraglide/runtime.js'

type Style = 'day' | 'short' | 'weekday' | 'month' | 'monthName' | 'monthShort'

const OPTIONS: Record<Style, Intl.DateTimeFormatOptions> = {
  day: { weekday: 'short', day: 'numeric', month: 'short' },
  short: { day: 'numeric', month: 'short' },
  weekday: { weekday: 'short' },
  month: { month: 'long', year: 'numeric' },
  monthName: { month: 'long' },
  monthShort: { month: 'short' },
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
/** `Ноябрь 2026 г` / `November 2026` / `Noviembre de 2026` */
export const fmtMonth = (t: number) => format('month', t)
/** `Ноябрь` / `November` / `Noviembre` */
export const fmtMonthName = (t: number) => format('monthName', t)
export const fmtMonthShort = (t: number) => format('monthShort', t)

export const fmtHours = (h: number) =>
  m.hours_short({ value: new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(h) })

const MINUTE = 60_000

/** A span of time in the largest sensible units: `25 min`, `2 h 10 min`, `3 d`. */
export function fmtDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / MINUTE))
  if (minutes >= 48 * 60) return m.duration_d({ count: Math.round(minutes / (24 * 60)) })
  if (minutes < 60) return m.duration_m({ minutes })
  const hours = Math.floor(minutes / 60)
  return minutes % 60 ? m.duration_hm({ hours, minutes: minutes % 60 }) : m.duration_h({ hours })
}

/**
 * What people call the time of an IANA zone in the current language: `Польша` / `Poland Time` for
 * `Europe/Warsaw`. Empty when the zone is not known here.
 */
export function fmtZoneRegion(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat(getLocale(), { timeZone: zone, timeZoneName: 'shortGeneric' }).formatToParts(
      0,
    )
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}

/**
 * Real time per planned time: `×1.25 · 25% longer`, `×0.8 · 20% shorter`. Never a bare percent, which makes ×2 look
 * twice as far from the plan as ×0.5 (docs/estimate-accuracy-research.md, 5.3).
 */
export function fmtRatio(ratio: number): string {
  const off = Math.round(Math.abs(ratio - 1) * 100)
  const percent = new Intl.NumberFormat(getLocale(), { style: 'percent' }).format(off / 100)
  if (!off) return `${fmtFactor(ratio)} · ${m.ratio_as_planned()}`
  return `${fmtFactor(ratio)} · ${ratio > 1 ? m.ratio_longer({ percent }) : m.ratio_shorter({ percent })}`
}

/** The factor alone, `×1.25`, where the words of `fmtRatio` stand next to it already. */
export const fmtFactor = (ratio: number) =>
  `×${new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 2 }).format(ratio)}`

/** How far a clock is from the plan's own, as a signed number of hours: `+2 ч`, `−5,5 ч`; empty for no difference. */
export const fmtShift = (ms: number) => (ms ? `${ms > 0 ? '+' : '−'}${fmtHours(Math.abs(ms) / 3_600_000)}` : '')
