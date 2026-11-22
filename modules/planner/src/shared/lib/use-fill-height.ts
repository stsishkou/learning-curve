import { useEffect, useState, type RefObject } from 'react'

const MIN_HEIGHT = 320
/** The page's bottom padding plus the card border around the box, so the box ends where the page does. */
const BOTTOM_GAP = 50

/**
 * The height between the element's top and the bottom of the screen, for a box that scrolls on its own:
 * with it the page itself has nothing left to scroll. Undefined until measured in the browser.
 */
export function useFillHeight(ref: RefObject<HTMLElement | null>, enabled = true): number | undefined {
  const [height, setHeight] = useState<number>()
  useEffect(() => {
    if (!enabled) return undefined
    const measure = () => {
      const el = ref.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      setHeight(Math.max(MIN_HEIGHT, window.innerHeight - top - BOTTOM_GAP))
    }
    measure()
    // The box moves when anything above it changes height, not only when the window does.
    const observer = new ResizeObserver(measure)
    observer.observe(document.body)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ref, enabled])
  return enabled ? height : undefined
}
