import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'learning-curve:reviews-declined'
/** Enough to cover every module finished in the weeks an offer is made for */
const KEEP = 50

/** The modules whose reviews were declined, by offer key, remembered per browser so the offer does not return. */
export function useDismissedReviews() {
  const [dismissed, setDismissed] = useState<readonly string[]>([])
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
      if (Array.isArray(saved)) setDismissed(saved.filter((key) => typeof key === 'string'))
    } catch {
      // storage unavailable: nothing was declined
    }
  }, [])
  const dismiss = (key: string) => {
    const next = [...dismissed.filter((other) => other !== key), key].slice(-KEEP)
    setDismissed(next)
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
    } catch {
      // ignore: the offer then stays away until the page is closed
    }
  }
  return { dismissed, dismiss }
}
