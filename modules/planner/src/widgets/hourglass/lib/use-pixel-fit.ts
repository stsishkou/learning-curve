import { useEffect, useState, type RefObject } from 'react'

export interface PixelFit {
  /** CSS px per cell: a whole number of device pixels, so every cell is drawn as a crisp square */
  cell: number
  /** Where the picture starts in the box, on whole device pixels too */
  left: number
  top: number
}

const NONE: PixelFit = { cell: 0, left: 0, top: 0 }

/** The largest picture of `columns` × `rows` cells that fits the box at a whole number of device pixels per cell. */
export function usePixelFit(box: RefObject<HTMLElement | null>, columns: number, rows: number): PixelFit {
  const [fit, setFit] = useState(NONE)
  useEffect(() => {
    const element = box.current
    if (!element) return undefined
    const measure = () => {
      const ratio = window.devicePixelRatio || 1
      const { clientWidth: width, clientHeight: height } = element
      const pixels = Math.floor(Math.min(width / columns, height / rows) * ratio)
      const cell = pixels / ratio
      const snap = (space: number) => Math.round((space / 2) * ratio) / ratio
      setFit(pixels < 1 ? NONE : { cell, left: snap(width - columns * cell), top: snap(height - rows * cell) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    // A zoom changes the device pixel ratio without resizing the box.
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [box, columns, rows])
  return fit
}
