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
  const showAll = useCallback(() => {
    setHidden(new Set())
    try {
      localStorage.removeItem(HIDDEN_KEY)
    } catch {
      // ignore
    }
  }, [])
  /**
   * Leaves only `ids` visible; when they already are the only ones, shows everything. Not remembered: it is a quick
   * look.
   */
  const solo = useCallback((ids: readonly string[], all: readonly string[]) => {
    setHidden((prev) => {
      const others = all.filter((other) => !ids.includes(other))
      const alreadySolo = ids.every((id) => !prev.has(id)) && others.every((other) => prev.has(other))
      return new Set(alreadySolo ? [] : others)
    })
  }, [])
  /** Leaves only `ids` visible, whatever was visible before. Not remembered either. */
  const showOnly = useCallback((ids: readonly string[], all: readonly string[]) => {
    setHidden(new Set(all.filter((other) => !ids.includes(other))))
  }, [])
  return { hidden, toggle, solo, showOnly, showAll, reset }
}
