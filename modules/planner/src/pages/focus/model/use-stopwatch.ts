import { useEffect, useState } from 'react'

const FOCUS_KEY = 'learning-curve:focus'

/** What the stopwatch holds: kept in the browser, and by Finish so an undo can give the time back */
export interface StopwatchState {
  /** What is being timed */
  uid: string
  /** Epoch ms of the last start; null while paused */
  startedAt: number | null
  /** Time counted before that start, in ms */
  banked: number
  /** Epoch ms of the first start: Finish keeps it as the real start, and the minutes the stopwatch stood follow */
  began: number
}

function read(): StopwatchState | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(FOCUS_KEY) ?? 'null')
    if (typeof saved !== 'object' || saved === null) return null
    if (!('uid' in saved) || typeof saved.uid !== 'string') return null
    if (!('banked' in saved) || typeof saved.banked !== 'number') return null
    const startedAt = 'startedAt' in saved && typeof saved.startedAt === 'number' ? saved.startedAt : null
    // A stopwatch kept before it knew its first start takes it as if it never stood.
    const began =
      'began' in saved && typeof saved.began === 'number' ? saved.began : (startedAt ?? Date.now()) - saved.banked
    return { uid: saved.uid, banked: saved.banked, startedAt, began }
  } catch {
    return null
  }
}

function write(saved: StopwatchState | null) {
  try {
    if (saved) localStorage.setItem(FOCUS_KEY, JSON.stringify(saved))
    else localStorage.removeItem(FOCUS_KEY)
  } catch {
    // ignore: the stopwatch then lasts until the page is closed
  }
}

export type Stopwatch = ReturnType<typeof useStopwatch>

/**
 * A stopwatch for one thing at a time, named by `uid`. It keeps the moment it was started, not a count, so it is
 * right after a reload, a sleeping laptop or a tab left in the background. `timed` is the uid it holds time for;
 * the page's clock asks it for the time at a moment with `elapsedAt`.
 */
export function useStopwatch() {
  const [saved, setSaved] = useState<StopwatchState | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setSaved(read())
    setReady(true)
  }, [])

  const keep = (next: StopwatchState | null) => {
    write(next)
    setSaved(next)
  }
  const elapsedAt = (at: number) =>
    saved ? saved.banked + (saved.startedAt === null ? 0 : Math.max(0, at - saved.startedAt)) : 0
  return {
    /** The stored state has been read: until then the stopwatch shows nothing */
    ready,
    timed: saved?.uid ?? null,
    running: saved !== null && saved.startedAt !== null,
    /** Epoch ms of the first start of what it holds time for */
    began: saved?.began ?? null,
    elapsedAt,
    /** Starts or resumes; time kept for another uid is dropped */
    start: (uid: string) => {
      const now = Date.now()
      const same = saved?.uid === uid
      keep({ uid, banked: same ? elapsedAt(now) : 0, startedAt: now, began: same ? saved.began : now })
    },
    // Counted to this moment, not to the last tick of the display.
    pause: () => {
      if (saved && saved.startedAt !== null) keep({ ...saved, banked: elapsedAt(Date.now()), startedAt: null })
    },
    reset: () => keep(null),
    /** What it holds, stopped at this moment */
    snapshot: (): StopwatchState | null => saved && { ...saved, banked: elapsedAt(Date.now()), startedAt: null },
    /** Holds what `snapshot` gave again */
    restore: (state: StopwatchState) => keep(state),
  }
}
