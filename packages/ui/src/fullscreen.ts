import { useSyncExternalStore } from 'react'

function subscribe(listener: () => void): () => void {
  document.addEventListener('fullscreenchange', listener)
  return () => document.removeEventListener('fullscreenchange', listener)
}

const shown = () => document.fullscreenElement !== null
const allowed = () => document.fullscreenEnabled
const never = () => false
// Most browsers can: a switch drawn by the server and taken away after hydration moves nothing in the many pages that
// keep it, where one added after hydration would push the buttons beside it on every load.
const likely = () => true

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
 * iPhone, a frame without leave), so the switch can stay hidden there; the server takes it as true.
 */
export function useFullscreen(): { supported: boolean; on: boolean; toggle: () => void } {
  const on = useSyncExternalStore(subscribe, shown, never)
  const supported = useSyncExternalStore(subscribe, allowed, likely)
  return { supported, on, toggle }
}
