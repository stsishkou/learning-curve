import { useCallback, useEffect, useState } from 'react'
import { nowMinsk } from './plan/dates'

/** Minsk wall-clock "now", available only after hydration (null during SSR) so markup matches. */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(nowMinsk())
    const id = window.setInterval(() => setNow(nowMinsk()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

const HIDDEN_KEY = 'learning-curve:hidden-calendars'

/** Calendars switched off in the filter, remembered per browser. */
export function useHiddenCalendars() {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')
      if (Array.isArray(saved) && saved.length) setHidden(new Set(saved.filter((id) => typeof id === 'string')))
    } catch {
      // storage unavailable: start with everything visible
    }
  }, [])
  const toggle = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]))
      } catch {
        // ignore
      }
      return next
    })
  }, [])
  const reset = useCallback(() => setHidden(new Set()), [])
  return { hidden, toggle, reset }
}

export function downloadBlob(filename: string, data: Blob | string, type = 'application/octet-stream') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** jszip is loaded on demand: only the export dialog needs it. */
export async function zipBlob(files: Record<string, string>): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const [name, content] of Object.entries(files)) zip.file(name, content)
  return zip.generateAsync({ type: 'blob' })
}
