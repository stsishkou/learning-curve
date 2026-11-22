import { useCallback, useEffect, useState } from 'react'

const HIDDEN_KEY = 'learning-curve:hidden-calendars'

/** Calendars switched off in the filter, remembered per browser. */
export function useHiddenCalendars() {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')
      if (Array.isArray(saved) && saved.length) setHidden(new Set(saved.filter((id) => typeof id === 'string')))
    } catch {
      // storage unavailable: start with everything visible
    }
  }, [])
  const toggle = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]))
      } catch {
        // ignore
      }
      return next
    })
  }, [])
  const reset = useCallback(() => setHidden(new Set()), [])
  /** Leaves only `id` visible; when it already is the only one, shows everything. Not remembered: it is a quick look. */
  const solo = useCallback((id: string, all: string[]) => {
    setHidden((prev) => {
      const others = all.filter((other) => other !== id)
      const alreadySolo = !prev.has(id) && others.every((other) => prev.has(other))
      return new Set(alreadySolo ? [] : others)
    })
  }, [])
  return { hidden, toggle, solo, reset }
}
