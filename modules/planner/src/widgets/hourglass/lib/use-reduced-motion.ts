import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(listener: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

/** The system asks for less motion. False on the server, so the first paint in the browser may move. */
export const useReducedMotion = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
