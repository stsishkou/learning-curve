import type { HistoryStep, HistoryView } from '@lc/plan-domain'
import { useEffect, useState } from 'react'

const SEEN_KEY = 'learning-curve:google-seen'

/** The latest steps of the history, up to now, that were edits taken from Google; oldest first. */
export function takenFromGoogle({ steps, cursor }: HistoryView): HistoryStep[] {
  const applied = steps.slice(0, cursor)
  const from = applied.findLastIndex((step) => step.source !== 'google') + 1
  return applied.slice(from)
}

/**
 * Remembers, per browser, the newest edit from Google the person has seen the notice for, so a dismissed notice does
 * not come back on the next visit.
 */
export function useSeenFromGoogle(steps: HistoryStep[]) {
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
    /** Edits from Google the person has not dismissed the notice for */
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
