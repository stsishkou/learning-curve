import { useEffect, useState } from 'react'

const POSITION_KEY = 'learning-curve:timeline'

export type TimelinePosition = 'below' | 'above' | 'hidden'

const isPosition = (value: string | null): value is TimelinePosition =>
  value === 'below' || value === 'above' || value === 'hidden'

/** Where the timeline sits on the planner, remembered per browser: below the header until another place is chosen. */
export function useTimelinePosition() {
  const [position, setPosition] = useState<TimelinePosition>('below')
  useEffect(() => {
    try {
      const stored = localStorage.getItem(POSITION_KEY)
      if (isPosition(stored)) setPosition(stored)
    } catch {
      // storage unavailable: below the header
    }
  }, [])
  const choose = (next: TimelinePosition) => {
    setPosition(next)
    try {
      if (next === 'below') localStorage.removeItem(POSITION_KEY)
      else localStorage.setItem(POSITION_KEY, next)
    } catch {
      // ignore: the choice then lasts until the page is closed
    }
  }
  return [position, choose] as const
}
