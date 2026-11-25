import { useEffect } from 'react'

/**
 * Puts `lead` before the tab's title ("12 min left · Focus"): the one place a hidden tab still shows the time. The
 * title the app set is given back when the lead goes, unless the app has changed it since.
 */
export function useTitleLead(lead: string | null) {
  useEffect(() => {
    if (!lead) return undefined
    const base = document.title
    const shown = `${lead} · ${base}`
    document.title = shown
    return () => {
      if (document.title === shown) document.title = base
    }
  }, [lead])
}
