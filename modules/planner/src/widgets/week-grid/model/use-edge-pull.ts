import { useEffect, useRef, type RefObject } from 'react'

/** How close to the edge of the visible hours, in px, a dragged edge starts to scroll or stretch the grid */
const EDGE = 20
const MAX_SCROLL = 24
/** How often the grid gains an hour while a slot is held at its first or last hour, in ms */
const STRETCH_EVERY = 200

export interface Pull {
  /** The edge of the slot that leads, px from the top of the window */
  edge: number
  /** -1 when it has been moved up, 1 down */
  way: number
}

export interface Pulling {
  /** The day column the slot is dragged in: its top is the first hour drawn */
  column: Element
  /** Places the slot for where the pointer is now; the hours under it may have scrolled or grown since */
  place: () => void
  /** The leading edge, or null while the slot has not moved */
  pull: () => Pull | null
}

interface Options {
  scroller: RefObject<HTMLElement | null>
  /** The row of day names, which stays at the top of the scroller and hides the hours under it */
  header: RefObject<HTMLElement | null>
  /** Adds an hour before the first one drawn (way -1) or after the last (1) */
  stretch: (way: number) => void
}

/** A bar stuck to the top of the window (see `stickyTop` in `@lc/ui`) hides what scrolls under it as well. */
const stuckTop = () =>
  Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lc-sticky-top')) || 0

function scrollBy(scroller: HTMLElement, dy: number) {
  const before = scroller.scrollTop
  scroller.scrollTop += dy
  // The grid scrolls inside itself only next to the side panel; elsewhere the page does.
  if (scroller.scrollTop === before) window.scrollBy(0, dy)
}

/**
 * Lets a slot be dragged past the hours on screen. While its leading edge is held at the top or the bottom of what
 * is visible, the grid first scrolls the hidden hours in, and once it has none left it gains an hour at that end,
 * so a session can be moved or drawn at any time of the day without switching to the full day.
 */
export function useEdgePull({ scroller, header, stretch }: Options) {
  const pulling = useRef<Pulling | null>(null)
  const frame = useRef(0)
  /** When the slot last reached an end with nothing left to scroll in, or 0 while it is away from both */
  const held = useRef(0)
  const stretchRef = useRef(stretch)
  useEffect(() => {
    stretchRef.current = stretch
  })

  const stop = () => {
    pulling.current = null
    cancelAnimationFrame(frame.current)
  }

  function step(time: number) {
    const current = pulling.current
    const box = scroller.current
    if (!current || !box) return
    current.place()
    const pull = current.pull()
    let waiting = false
    if (pull) {
      const view = box.getBoundingClientRect()
      const top = Math.max(view.top + (header.current?.offsetHeight ?? 0), stuckTop())
      const bottom = Math.min(view.bottom, window.innerHeight)
      const column = current.column.getBoundingClientRect()
      const past = pull.way < 0 ? top + EDGE - pull.edge : pull.edge - (bottom - EDGE)
      const hidden = pull.way < 0 ? column.top < top - 1 : column.bottom > bottom + 1
      if (past > 0 && hidden) scrollBy(box, pull.way * Math.min(MAX_SCROLL, 2 + past / 2))
      else if (past > 0) {
        // A slot only swung past the end is not a reason to grow the day: it has to stay there a moment.
        waiting = true
        if (!held.current) held.current = time
        else if (time - held.current >= STRETCH_EVERY) {
          held.current = time
          stretchRef.current(pull.way)
        }
      }
    }
    if (!waiting) held.current = 0
    frame.current = requestAnimationFrame(step)
  }

  const start = (next: Pulling) => {
    stop()
    pulling.current = next
    held.current = 0
    frame.current = requestAnimationFrame(step)
  }

  useEffect(() => {
    const frames = frame
    return () => cancelAnimationFrame(frames.current)
  }, [])
  return { start, stop }
}
