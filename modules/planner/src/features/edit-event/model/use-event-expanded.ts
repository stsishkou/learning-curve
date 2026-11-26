import { ANCHOR_FROM } from '@lc/ui'
import { useLayoutEffect, useState, useSyncExternalStore } from 'react'

/** `1` while event dialogs open expanded; removed otherwise */
export const EVENT_EXPANDED_KEY = 'learning-curve:event-expanded'

const QUERY = `(min-width: ${ANCHOR_FROM}px)`

export const parseEventExpanded = (raw: string | null): boolean => raw === '1'

function subscribe(listener: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

/**
 * Whether event dialogs open expanded, remembered per browser. `available` is false while the window is narrower
 * than the width at which a dialog sits beside its event: there it is already centred, and `expanded` stays false.
 */
export function useEventExpanded(): { available: boolean; expanded: boolean; toggle: () => void } {
  const available = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
  const [stored, setStored] = useState(false)
  // A layout effect, not a passive one: the dialog calls showModal() in a passive effect, and a choice read after it
  // would show a dialog opened from a link small for a frame before it grows.
  useLayoutEffect(() => {
    try {
      setStored(parseEventExpanded(localStorage.getItem(EVENT_EXPANDED_KEY)))
    } catch {
      // storage unavailable: dialogs open small
    }
  }, [])
  const toggle = () => {
    const next = !stored
    setStored(next)
    try {
      if (next) localStorage.setItem(EVENT_EXPANDED_KEY, '1')
      else localStorage.removeItem(EVENT_EXPANDED_KEY)
    } catch {
      // ignore: the choice then lasts until the page is closed
    }
  }
  return { available, expanded: stored && available, toggle }
}
