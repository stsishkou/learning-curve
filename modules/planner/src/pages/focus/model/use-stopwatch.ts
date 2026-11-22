import { useEffect, useState } from 'react'

const FOCUS_KEY = 'learning-curve:focus'

interface Saved {
  /** What is being timed */
  uid: string
  /** Epoch ms of the last start; null while paused */
  startedAt: number | null
  /** Time counted before that start, in ms */
  banked: number
}

function read(): Saved | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(FOCUS_KEY) ?? 'null')
    if (typeof saved !== 'object' || saved === null) return null
    if (!('uid' in saved) || typeof saved.uid !== 'string') return null
    if (!('banked' in saved) || typeof saved.banked !== 'number') return null
    const startedAt = 'startedAt' in saved && typeof saved.startedAt === 'number' ? saved.startedAt : null
    return { uid: saved.uid, banked: saved.banked, startedAt }
  } catch {
    return null
  }
}

function write(saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(FOCUS_KEY, JSON.stringify(saved))
    else localStorage.removeItem(FOCUS_KEY)
  } catch {
    // ignore: the stopwatch then lasts until the page is closed
  }
}

/**
 * A stopwatch for one thing at a time, named by `uid`. It keeps the moment it was started, not a count, so it is
 * right after a reload, a sleeping laptop or a tab left in the background. `timed` is the uid it holds time for.
 */
export function useStopwatch() {
  const [saved, setSaved] = useState<Saved | null>(null)
  const [clock, setClock] = useState(0)
  useEffect(() => {
    setSaved(read())
    setClock(Date.now())
  }, [])
  const running = saved?.startedAt != null
  useEffect(() => {
    if (!running) return undefined
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running])

  const keep = (next: Saved | null) => {
    write(next)
    setSaved(next)
    setClock(Date.now())
  }
  const elapsed = saved ? saved.banked + (saved.startedAt === null ? 0 : Math.max(0, clock - saved.startedAt)) : 0
  return {
    timed: saved?.uid ?? null,
    elapsed,
    running,
    /** Starts or resumes; time kept for another uid is dropped */
    start: (uid: string) => keep({ uid, banked: saved?.uid === uid ? elapsed : 0, startedAt: Date.now() }),
    // Counted to this moment, not to the last tick of the display.
    pause: () =>
      saved?.startedAt != null &&
      keep({ ...saved, banked: saved.banked + Math.max(0, Date.now() - saved.startedAt), startedAt: null }),
    reset: () => keep(null),
  }
}
