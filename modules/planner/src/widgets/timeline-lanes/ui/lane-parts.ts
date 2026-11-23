import type { CSSProperties } from 'react'

import { clampPct, type Scale } from '../lib/scale'

/** A thin band across the middle of a track */
export const BAND = 'absolute top-1/2 h-2 -translate-y-1/2'

/** Left edge and width of the time from `a` to `b` on a track, clamped to it. */
export function span(scale: Scale, a: number, b: number): CSSProperties {
  const left = clampPct(scale.at(a))
  return { left: `${left}%`, width: `${Math.max(0, clampPct(scale.at(b)) - left)}%` }
}
