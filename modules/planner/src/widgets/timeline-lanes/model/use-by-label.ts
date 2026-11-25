import { useEffect, useState } from 'react'

const BY_LABEL_KEY = 'learning-curve:timeline-by-label'

/** Whether the timeline groups its lanes by label, remembered per browser: off until it is switched on. */
export function useByLabel() {
  const [byLabel, setByLabel] = useState(false)
  useEffect(() => {
    try {
      setByLabel(localStorage.getItem(BY_LABEL_KEY) === '1')
    } catch {
      // storage unavailable: not grouped
    }
  }, [])
  const choose = (next: boolean) => {
    setByLabel(next)
    try {
      if (next) localStorage.setItem(BY_LABEL_KEY, '1')
      else localStorage.removeItem(BY_LABEL_KEY)
    } catch {
      // ignore: the choice then lasts until the page is closed
    }
  }
  return [byLabel, choose] as const
}
