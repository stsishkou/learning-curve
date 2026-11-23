import type { HistoryStep, HistoryView } from '@lc/plan-domain'
import { useEffect, useState } from 'react'

const SEEN_KEY = 'learning-curve:sync-seen'

/** The latest steps of the history, up to now, that were edits taken from a calendar app; oldest first. */
export function takenFromApps({ steps, cursor }: HistoryView): HistoryStep[] {
  const applied = steps.slice(0, cursor)
  const from = applied.findLastIndex((step) => step.source === undefined) + 1
  return applied.slice(from)
}

/**
 * Remembers, per browser, the newest edit from a calendar app the person has seen the notice for, so a dismissed
 * notice does not come back on the next visit.
 */
export function useSeenFromApps(steps: HistoryStep[]) {
  const [seen, setSeen] = useState('')
  useEffect(() => {
    try {
      setSeen(localStorage.getItem(SEEN_KEY) ?? '')
    } catch {
      // storage unavailable: the notice shows until it is dismissed
    }
  }, [])
  const newest = steps.at(-1)?.at ?? ''
  return {
    /** Edits from the apps the person has not dismissed the notice for */
    unseen: newest > seen,
    dismiss: () => {
      setSeen(newest)
      try {
        localStorage.setItem(SEEN_KEY, newest)
      } catch {
        // ignore: the notice then stays away until the page is closed
      }
    },
  }
}
