import type { CalendarProvider } from '@lc/plan-domain'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { CalendarSyncSource, CalendarSyncStatus, HeldEdit } from './source'

/** Edits made in the apps are read this often while the planner is open, varied by ±25 % */
const EVERY = 10 * 60_000
/** Coming back to the page reads them again, but not more often than this */
const AT_MOST = 60_000

type Call = (source: CalendarSyncSource) => Promise<CalendarSyncStatus>

/**
 * Keeps every connected calendar app in step while the planner is open: a round when it opens, when the page is
 * shown again and every ten minutes. The plan's own changes are sent by the host as they are saved.
 */
export function useCalendarSync(sources: readonly CalendarSyncSource[]) {
  // What a round returned, kept until the host passes a newer state.
  const [latest, setLatest] = useState<
    Partial<Record<CalendarProvider, { base: CalendarSyncStatus; status: CalendarSyncStatus }>>
  >({})
  const [working, setWorking] = useState<ReadonlySet<CalendarProvider>>(new Set())
  const [errors, setErrors] = useState<Partial<Record<CalendarProvider, string>>>({})
  const current = useRef(sources)
  useEffect(() => {
    current.current = sources
  })
  const last = useRef(0)

  const statuses = useMemo(
    () =>
      sources.map(({ status }) => {
        const kept = latest[status.provider]
        return kept?.base === status ? kept.status : status
      }),
    [sources, latest],
  )

  const run = useCallback(async (provider: CalendarProvider, call: Call) => {
    const host = current.current.find((source) => source.status.provider === provider)
    if (!host) return
    const flag = (on: boolean) =>
      setWorking((prev) => {
        const next = new Set(prev)
        if (on) next.add(provider)
        else next.delete(provider)
        return next
      })
    flag(true)
    setErrors((prev) => ({ ...prev, [provider]: '' }))
    try {
      const status = await call(host)
      const base = current.current.find((source) => source.status.provider === provider)?.status
      if (base) setLatest((prev) => ({ ...prev, [provider]: { base, status } }))
    } catch (err) {
      setErrors((prev) => ({ ...prev, [provider]: err instanceof Error ? err.message : String(err) }))
    } finally {
      flag(false)
    }
  }, [])

  const live = statuses
    .filter((status) => status.writable && status.connectedAt !== null)
    .map((status) => status.provider)
    .join(' ')
  useEffect(() => {
    if (!live) return undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const round = () => {
      clearTimeout(timer)
      last.current = Date.now()
      const connected = live.split(' ')
      for (const { status } of current.current) {
        if (connected.includes(status.provider)) void run(status.provider, (host) => host.sync())
      }
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

  /** Every edit that waits for a decision, in whichever app it was made */
  const held = useMemo(
    () => statuses.flatMap((status) => status.inbox.map((item): HeldEdit => ({ ...item, provider: status.provider }))),
    [statuses],
  )
  /** Sends the chosen held edits to the app each was made in */
  const decide = (ids: string[], call: (source: CalendarSyncSource, ids: string[]) => Promise<CalendarSyncStatus>) => {
    for (const status of statuses) {
      const mine = status.inbox.filter((item) => ids.includes(item.id)).map((item) => item.id)
      if (mine.length) void run(status.provider, (host) => call(host, mine))
    }
  }

  return {
    statuses,
    held,
    /** A round or a decision runs for `provider`; without one, for any app */
    working: (provider?: CalendarProvider) => (provider ? working.has(provider) : working.size > 0),
    /** Why the last call to `provider` failed; without one, the first failure of any app */
    error: (provider?: CalendarProvider) =>
      provider ? (errors[provider] ?? '') : (Object.values(errors).find(Boolean) ?? ''),
    sync: (provider: CalendarProvider) => void run(provider, (host) => host.sync()),
    accept: (ids: string[]) => decide(ids, (host, mine) => host.accept(mine)),
    reject: (ids: string[]) => decide(ids, (host, mine) => host.reject(mine)),
  }
}
