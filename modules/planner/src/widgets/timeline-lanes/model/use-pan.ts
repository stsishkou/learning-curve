import { useState, type PointerEvent as ReactPointerEvent } from 'react'

// A press on these is theirs: a course, its handles, a link.
const PRESSABLE = 'button, a, input, label, [role="slider"]'

/**
 * Days with nothing on them can be grabbed with the mouse and dragged to scroll, as a map is. Touch scrolls them by
 * itself, so only a mouse pans here.
 */
export function usePan() {
  const [panning, setPanning] = useState(false)

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    const box = e.currentTarget
    const { target } = e
    if (e.pointerType !== 'mouse' || e.button !== 0 || box.scrollWidth <= box.clientWidth) return
    if (!(target instanceof Element) || !target.closest('[data-track], [data-axis]') || target.closest(PRESSABLE)) {
      return
    }
    // No text selection and no focus ring while the days are dragged.
    e.preventDefault()
    const from = { x: e.clientX, left: box.scrollLeft }
    const move = (event: PointerEvent) => {
      box.scrollLeft = from.left - (event.clientX - from.x)
    }
    const end = () => {
      box.removeEventListener('pointermove', move)
      box.removeEventListener('pointerup', end)
      box.removeEventListener('pointercancel', end)
      setPanning(false)
    }
    box.setPointerCapture(e.pointerId)
    box.addEventListener('pointermove', move)
    box.addEventListener('pointerup', end)
    box.addEventListener('pointercancel', end)
    setPanning(true)
  }

  return { panning, onPointerDown }
}
