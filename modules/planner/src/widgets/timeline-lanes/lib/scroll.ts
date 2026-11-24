const SCROLLS = /^(auto|scroll|overlay)$/
const LINE_PX = 16

/** Whether the element, or a box around it up to the page itself, can still scroll up (`dy` < 0) or down. */
export function canScrollY(from: Element, dy: number): boolean {
  for (let el: Element | null = from; el; el = el.parentElement) {
    if (el !== el.ownerDocument.scrollingElement && !SCROLLS.test(getComputedStyle(el).overflowY)) continue
    if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true
  }
  return false
}

/**
 * A mouse wheel turned over days wider than the view scrolls them sideways, but only when nothing around can scroll
 * up or down: the page keeps its own wheel. Shift + wheel and a trackpad's sideways swipe stay the browser's.
 */
export function wheelSideways(e: WheelEvent) {
  const box = e.currentTarget
  if (!(box instanceof HTMLElement) || e.ctrlKey || e.shiftKey) return
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || box.scrollWidth <= box.clientWidth) return
  if (e.target instanceof Element && canScrollY(e.target, e.deltaY)) return
  const unit =
    e.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? LINE_PX
      : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? box.clientWidth
        : 1
  const left = box.scrollLeft
  box.scrollLeft = left + e.deltaY * unit
  if (box.scrollLeft !== left) e.preventDefault()
}

/** Where the days sit in their scroller: the width of the names column before them and the pixels of days in view. */
export function daysInView(box: HTMLElement, track: HTMLElement) {
  const names = track.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft
  return { names, visible: box.clientWidth - names }
}
