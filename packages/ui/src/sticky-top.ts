/** Height of each bar that may stick to the top of the window; 0 while it does not stick at this width. */
const heights = new Map<Element, number>()

function publish() {
  document.documentElement.style.setProperty('--lc-sticky-top', `${Math.max(0, ...heights.values())}px`)
}

/**
 * A ref for a bar that sticks to the top of the window. It keeps `--lc-sticky-top` at the bar's height, and the
 * theme pads the page's scrolling by it: a control reached with Tab is then scrolled into view below the bar, not
 * under it.
 */
export function stickyTop(bar: HTMLElement | null) {
  if (!bar) return undefined
  const measure = () => {
    heights.set(bar, getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight : 0)
    publish()
  }
  // The bar changes height, and whether it sticks, when the window crosses a breakpoint.
  const observer = new ResizeObserver(measure)
  observer.observe(bar)
  measure()
  return () => {
    observer.disconnect()
    heights.delete(bar)
    publish()
  }
}
