import { useEffect, useState } from 'react'

const BY_LABEL_KEY = 'learning-curve:progress-by-label'

/** Whether the weekly load and the courses are totalled by label, remembered per browser: by course until chosen. */
export function useByLabel() {
  const [byLabel, setByLabel] = useState(false)
  useEffect(() => {
    try {
      setByLabel(localStorage.getItem(BY_LABEL_KEY) === '1')
    } catch {
      // storage unavailable: by course
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
