import { useEffect, useRef, type RefObject } from 'react'

/**
 * Calls `frame` on every animation frame while `active` and `target` is on screen. A hidden tab gets no frames at
 * all, so nothing is drawn that nobody sees; the picture is a function of the clock and needs no catching up.
 */
export function useFrames(target: RefObject<Element | null>, active: boolean, frame: (time: number) => void) {
  const latest = useRef(frame)
  useEffect(() => {
    latest.current = frame
  })
  useEffect(() => {
    const element = target.current
    if (!active || !element) return undefined
    let id = 0
    const loop = (time: number) => {
      latest.current(time)
      id = requestAnimationFrame(loop)
    }
    const observer = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(id)
      if (entry?.isIntersecting !== false) id = requestAnimationFrame(loop)
    })
    observer.observe(element)
    return () => {
      cancelAnimationFrame(id)
      observer.disconnect()
    }
  }, [active, target])
}
