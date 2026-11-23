import { useEffect, useState } from 'react'

const ZOOM_KEY = 'learning-curve:timeline-zoom'

export type TimelineZoom = 'fit' | 'month' | 'week'

/** Pixels a day at the zooms that do not fit the width: a month reads at a glance, a week lets a day be aimed at. */
export const PX_PER_DAY: Record<Exclude<TimelineZoom, 'fit'>, number> = { month: 14, week: 40 }

const isZoom = (value: string | null): value is TimelineZoom => value === 'fit' || value === 'month' || value === 'week'

/** How close the timeline is drawn, remembered per browser: the whole plan until another zoom is chosen. */
export function useZoom() {
  const [zoom, setZoom] = useState<TimelineZoom>('fit')
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ZOOM_KEY)
      if (isZoom(stored)) setZoom(stored)
    } catch {
      // storage unavailable: the whole plan
    }
  }, [])
  const choose = (next: TimelineZoom) => {
    setZoom(next)
    try {
      if (next === 'fit') localStorage.removeItem(ZOOM_KEY)
      else localStorage.setItem(ZOOM_KEY, next)
    } catch {
      // ignore: the choice then lasts until the page is closed
    }
  }
  return [zoom, choose] as const
}
