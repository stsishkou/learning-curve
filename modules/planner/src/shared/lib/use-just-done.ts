import type { Occurrence } from '@lc/plan-domain'
import { useEffect, useRef, useState } from 'react'

import { eventKey } from './event-key'

/** How long an event keeps its "just done" mark: longer than the animation, which then has nothing left to play. */
const HOLD = 1200

/**
 * The keys of the events on screen that turned done a moment ago, for a short animation. Only the change counts: an
 * event that is done on the first render, or comes into view already done (another week, a filter), stays still.
 */
export function useJustDone(items: readonly Occurrence[]): ReadonlySet<string> {
  const seen = useRef<ReadonlyMap<string, boolean> | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    const before = seen.current
    const after = new Map(items.map((o) => [eventKey(o), o.done === true]))
    seen.current = after
    if (!before) return
    const turned = [...after].flatMap(([key, done]) => (done && before.get(key) === false ? [key] : []))
    if (!turned.length) return
    setFresh(new Set(turned))
    // Not a cleanup of this effect: the items change again long before the mark is due to go.
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFresh(new Set()), HOLD)
  }, [items])

  useEffect(() => () => window.clearTimeout(timer.current), [])
  return fresh
}
