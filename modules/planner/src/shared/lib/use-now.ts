import { nowMinsk } from '@lc/plan-domain'
import { useEffect, useState } from 'react'

/** Minsk wall-clock "now", available only after hydration (null during SSR) so markup matches. */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(nowMinsk())
    const id = window.setInterval(() => setNow(nowMinsk()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}
