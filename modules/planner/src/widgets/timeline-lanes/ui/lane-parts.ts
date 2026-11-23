import { m } from '@lc/i18n/messages'
import { DAY } from '@lc/plan-domain'
import type { CSSProperties } from 'react'

import { clampPct, type Scale } from '../lib/scale'

/** A band across the middle of a track */
export const BAND = 'absolute top-1/2 h-2.5 -translate-y-1/2'

/** Left edge and width of the time from `a` to `b` on a track, clamped to it. */
export function span(scale: Scale, a: number, b: number): CSSProperties {
  const left = clampPct(scale.at(a))
  return { left: `${left}%`, width: `${Math.max(0, clampPct(scale.at(b)) - left)}%` }
}

/** Days from the day after the last session to the deadline, both day ms: negative when the course would be late. */
export const spareDays = (last: number, deadline: number) => Math.round((deadline - last) / DAY) - 1

/** Spare or late days, in words. */
export const spareText = (spare: number) =>
  spare >= 0 ? m.timeline_spare({ days: spare }) : m.timeline_late({ days: -spare })

/** A number of days or weeks with its sign: `+14`, `−7`. */
export const signed = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`
