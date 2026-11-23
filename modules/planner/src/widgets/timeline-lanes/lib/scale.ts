import { DAY, parseLocal } from '@lc/plan-domain'

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
