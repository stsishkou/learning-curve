import { useEffect, useState } from 'react'

export type WidePanel = 'next' | 'insights'
export type WidePanels = Record<WidePanel, boolean>

/** The panels shown, as a JSON list of their names: `["insights"]` */
export const WIDE_PANELS_KEY = 'learning-curve:wide-panels'

const PANELS: readonly WidePanel[] = ['next', 'insights']
const NONE: WidePanels = { next: false, insights: false }

/** The panels a stored list names; anything else reads as none shown. */
export function parseWidePanels(raw: string | null): WidePanels {
  let saved: unknown = null
  try {
    saved = JSON.parse(raw ?? '[]')
  } catch {
    // not JSON: nothing is shown
  }
  const names: readonly unknown[] = Array.isArray(saved) ? saved : []
  return { next: names.includes('next'), insights: names.includes('insights') }
}

/**
 * The side panels the wide layout shows next to the calendar, remembered per browser. None until the stored choice
 * is read after mount, so the wide layout first looks as it did before panels could be shown in it.
 */
export function useWidePanels() {
  const [shown, setShown] = useState<WidePanels>(NONE)
  useEffect(() => {
    try {
      setShown(parseWidePanels(localStorage.getItem(WIDE_PANELS_KEY)))
    } catch {
      // storage unavailable: no side panel
    }
  }, [])
  const toggle = (panel: WidePanel) => {
    const next: WidePanels = { ...shown, [panel]: !shown[panel] }
    setShown(next)
    const names = PANELS.filter((name) => next[name])
    try {
      if (names.length) localStorage.setItem(WIDE_PANELS_KEY, JSON.stringify(names))
      else localStorage.removeItem(WIDE_PANELS_KEY)
    } catch {
      // ignore: the choice then lasts until the page is closed
    }
  }
  return { shown, toggle }
}
