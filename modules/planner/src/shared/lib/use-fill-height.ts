import { useEffect, useState, type RefObject } from 'react'

const MIN_HEIGHT = 240
/** The page's bottom padding plus the card border around the box, so the box ends where the page does. */
const BOTTOM_GAP = 50

interface Options {
  /** Below this window width the box keeps its own height: on a phone the page is what scrolls */
  minWidth?: number
  minHeight?: number
  /** What stays between the box and the bottom of the screen */
  bottomGap?: number
}

/**
 * The height between the element's top and the bottom of the screen, for a box that scrolls on its own:
 * with it the page itself has nothing left to scroll. Undefined until measured in the browser.
 */
export function useFillHeight(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
  { minWidth = 0, minHeight = MIN_HEIGHT, bottomGap = BOTTOM_GAP }: Options = {},
): number | undefined {
  const [height, setHeight] = useState<number>()
  useEffect(() => {
    if (!enabled) return undefined
    const measure = () => {
      const el = ref.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      setHeight(window.innerWidth < minWidth ? undefined : Math.max(minHeight, window.innerHeight - top - bottomGap))
    }
    measure()
    // The box moves when anything above it changes height, not only when the window does. Its own column counts too:
    // a card above it can go while a taller column next to it keeps the page's height.
    const observer = new ResizeObserver(measure)
    let node: HTMLElement | null = ref.current?.parentElement ?? document.body
    while (node) {
      observer.observe(node)
      node = node.parentElement
    }
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ref, enabled, minWidth, minHeight, bottomGap])
  return enabled ? height : undefined
}
