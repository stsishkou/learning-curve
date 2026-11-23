import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

/** As in the week grid: a finger picks a thing up only after resting on it, so a swipe still scrolls the page. */
const LONG_PRESS = 350
const DRAG_THRESHOLD = 4
const TOUCH_SLOP = 8

export interface NudgeOptions {
  /** Days the track of the pressed element (`[data-track]`) stands for */
  days: number
  /** Days a drag snaps to */
  step: 1 | 7
  /** Bounds of the offset, in days */
  min: number
  max: number
  onCommit: (offset: number) => void
}

interface Press {
  /** The pointer that pressed: another finger is not this press */
  id: number
  x: number
  y: number
  perPixel: number
  armed: boolean
  moved: boolean
  /** Escape put the thing back: the press only waits to be let go */
  cancelled: boolean
  timer?: number
  /** Stops the page from scrolling under a finger that has picked the thing up */
  hold?: (e: TouchEvent) => void
}

const KEY_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageUp: 7,
  PageDown: -7,
}

function forget(p: Press | null) {
  window.clearTimeout(p?.timer)
  if (p?.hold) document.removeEventListener('touchmove', p.hold)
}

/**
 * A thing on the timeline moved by days: dragged with a mouse or, after a long press, a finger, or stepped by keys
 * as a slider. The offset is only shown until it is committed, on drop or with Enter; Escape puts it back.
 */
export function useNudge({ days, step, min, max, onCommit }: NudgeOptions) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const press = useRef<Press | null>(null)
  const dropped = useRef(false)

  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  const offsetAt = (p: Press, clientX: number) => clamp(Math.round(((clientX - p.x) * p.perPixel) / step) * step)
  const own = (e: PointerEvent<HTMLElement>) => {
    const p = press.current
    return p?.id === e.pointerId ? p : null
  }

  function release(moved: boolean) {
    forget(press.current)
    press.current = null
    setDragging(false)
    setOffset(0)
    // The browser sends a click after a drop on the thing that was dragged: it must not open anything.
    if (moved) {
      dropped.current = true
      window.setTimeout(() => (dropped.current = false), 50)
    }
  }

  /** Puts the thing back; the press stays until it is let go, so the click that follows is still swallowed. */
  function cancel() {
    const p = press.current
    if (!p || p.cancelled) return
    p.cancelled = true
    window.clearTimeout(p.timer)
    setDragging(false)
    setOffset(0)
  }

  useEffect(() => () => forget(press.current), [])

  useEffect(() => {
    if (!dragging) return undefined
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }
    // Capture: a handler on the way down must not keep a drag alive by stopping the key.
    window.addEventListener('keydown', onEscape, true)
    return () => window.removeEventListener('keydown', onEscape, true)
  }, [dragging])

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (e.button !== 0 || !e.isPrimary || press.current) return
    const width = e.currentTarget.closest('[data-track]')?.getBoundingClientRect().width ?? 0
    const touch = e.pointerType === 'touch'
    const next: Press = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      perPixel: days / Math.max(1, width),
      armed: !touch,
      moved: false,
      cancelled: false,
    }
    press.current = next
    if (!touch) {
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    // Only a non-passive listener can keep the page still: it lives as long as the press.
    next.hold = (event) => {
      if (next.armed && !next.cancelled) event.preventDefault()
    }
    document.addEventListener('touchmove', next.hold, { passive: false })
    next.timer = window.setTimeout(() => {
      next.armed = true
      if ('vibrate' in navigator) navigator.vibrate(8)
      setDragging(true)
    }, LONG_PRESS)
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const p = own(e)
    if (!p || p.cancelled) return
    const dx = e.clientX - p.x
    if (!p.armed) {
      if (Math.hypot(dx, e.clientY - p.y) > TOUCH_SLOP) release(false)
      return
    }
    if (!p.moved && Math.abs(dx) < DRAG_THRESHOLD) return
    p.moved = true
    setDragging(true)
    setOffset(offsetAt(p, e.clientX))
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    const p = own(e)
    if (!p) return
    const by = p.moved && !p.cancelled ? offsetAt(p, e.clientX) : 0
    release(p.moved)
    if (by !== 0) onCommit(by)
  }

  function onPointerCancel(e: PointerEvent<HTMLElement>) {
    const p = own(e)
    if (p) release(p.moved)
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    // While a pointer holds the thing, the drop decides; Escape still puts it back.
    if (press.current) {
      if (e.key === 'Escape' || e.key === 'Enter') e.preventDefault()
      if (e.key === 'Escape') cancel()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      setOffset(0)
      if (offset !== 0) onCommit(offset)
      return
    }
    if (e.key === 'Escape') {
      if (offset !== 0) e.stopPropagation()
      setOffset(0)
      return
    }
    const bound = e.key === 'Home' ? min : e.key === 'End' ? max : null
    const by = KEY_STEPS[e.key]
    if (bound === null && by === undefined) return
    e.preventDefault()
    setOffset((current) => bound ?? clamp(current + (by ?? 0)))
  }

  function onBlur() {
    if (!press.current) setOffset(0)
  }

  return {
    /** Days the thing is moved by and not yet committed; 0 when at rest */
    offset,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
    onBlur,
    /** true for the click a drop leaves behind: it is to be ignored */
    afterDrop: () => dropped.current,
  }
}
