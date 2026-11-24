import { useEffect, useState } from 'react'

const ZONE_KEY = 'learning-curve:second-zone'

/** The second time zone of the hour column, an IANA name, remembered per browser; null when there is none. */
export function useSecondZone() {
  const [zone, setZone] = useState<string | null>(null)
  useEffect(() => {
    try {
      setZone(localStorage.getItem(ZONE_KEY))
    } catch {
      // storage unavailable: no second zone
    }
  }, [])
  const choose = (next: string | null) => {
    setZone(next)
    try {
      if (next) localStorage.setItem(ZONE_KEY, next)
      else localStorage.removeItem(ZONE_KEY)
    } catch {
      // ignore: the choice then lasts until the page is closed
    }
  }
  return [zone, choose] as const
}
