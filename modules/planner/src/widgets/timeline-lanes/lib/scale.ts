import { DAY, mondayOf, parseLocal, ymd } from '@lc/plan-domain'

/** The days a timeline draws and where a moment falls on its tracks. */
export interface Scale {
  /** Day ms; `end` is excluded */
  start: number
  end: number
  days: number
  /** Percent of the track's width at a moment, not clamped */
  at: (t: number) => number
}

export function scaleOf({ start, end }: { start: number; end: number }): Scale {
  return { start, end, days: (end - start) / DAY, at: (t) => ((t - start) / (end - start)) * 100 }
}

/** A `YYYY-MM-DD` day as day ms */
export const dayMs = (day: string) => parseLocal(day)

export const clampPct = (pct: number) => Math.max(0, Math.min(100, pct))

/** Where the axis marks months and weeks: the first day of each month and each Monday inside the drawn days. */
export interface Ticks {
  months: number[]
  mondays: number[]
}

const firstOfNextMonth = (t: number) => {
  const [year = 0, month = 1] = ymd(t).split('-').map(Number)
  return parseLocal(month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`)
}

export function ticksOf(scale: Scale): Ticks {
  const months: number[] = []
  for (let t = firstOfNextMonth(scale.start); t < scale.end; t = firstOfNextMonth(t)) months.push(t)
  const mondays: number[] = []
  for (let t = mondayOf(scale.start); t < scale.end; t += 7 * DAY) if (t >= scale.start) mondays.push(t)
  return { months, mondays }
}
