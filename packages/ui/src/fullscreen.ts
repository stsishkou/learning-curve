import { useSyncExternalStore } from 'react'

function subscribe(listener: () => void): () => void {
  document.addEventListener('fullscreenchange', listener)
  return () => document.removeEventListener('fullscreenchange', listener)
}

const shown = () => document.fullscreenElement !== null
const allowed = () => document.fullscreenEnabled
const never = () => false

async function flip(): Promise<void> {
  try {
    await (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())
  } catch {
    // Refused when the browser does not count the press as the person's, or a frame is not allowed it.
  }
}

const toggle = () => void flip()

/**
 * Whether the page fills the whole screen, and the switch for it. `supported` is false where the browser cannot (an
 * iPhone, a frame without leave) and on the server, so the switch can stay hidden there.
 */
export function useFullscreen(): { supported: boolean; on: boolean; toggle: () => void } {
  const on = useSyncExternalStore(subscribe, shown, never)
  const supported = useSyncExternalStore(subscribe, allowed, never)
  return { supported, on, toggle }
}
