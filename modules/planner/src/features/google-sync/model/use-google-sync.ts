import { useCallback, useEffect, useRef, useState } from 'react'

import type { GoogleSyncSource, GoogleSyncStatus } from './source'

/** Google's edits are read this often while the planner is open, varied by ±25 % */
const EVERY = 10 * 60_000
/** Coming back to the page reads them again, but not more often than this */
const AT_MOST = 60_000

/**
 * Keeps the Google sync going while the planner is open: a round when it opens, when the page is shown again and
 * every ten minutes. The plan's own changes are sent by the host as they are saved.
 */
export function useGoogleSync(source: GoogleSyncSource | undefined) {
  const base = source?.status ?? null
  // What a round returned, kept until the host passes a newer state.
  const [latest, setLatest] = useState<{ base: GoogleSyncStatus | null; status: GoogleSyncStatus } | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const status = latest?.base === base ? latest.status : base
  const current = useRef(source)
  useEffect(() => {
    current.current = source
  })
  const last = useRef(0)

  const run = useCallback(async (call: (source: GoogleSyncSource) => Promise<GoogleSyncStatus>) => {
    const host = current.current
    if (!host) return
    setWorking(true)
    setError('')
    try {
      const next = await call(host)
      setLatest({ base: current.current?.status ?? null, status: next })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setWorking(false)
    }
  }, [])

  const live = status?.writable === true && status.connectedAt !== null
  useEffect(() => {
    if (!live) return undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const round = () => {
      clearTimeout(timer)
      last.current = Date.now()
      void run((host) => host.sync())
      timer = setTimeout(round, EVERY * (0.75 + Math.random() * 0.5))
    }
    const wake = () => {
      if (document.visibilityState === 'visible' && Date.now() - last.current > AT_MOST) round()
    }
    round()
    window.addEventListener('focus', wake)
    document.addEventListener('visibilitychange', wake)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', wake)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [live, run])

  return {
    status,
    working,
    error,
    sync: () => void run((host) => host.sync()),
    accept: (ids: string[]) => void run((host) => host.accept(ids)),
    reject: (ids: string[]) => void run((host) => host.reject(ids)),
  }
}
