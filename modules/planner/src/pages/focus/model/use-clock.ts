import { useCallback, useEffect, useState } from 'react'

/**
 * Epoch ms for the page, 0 until mounted. It is read again every second while `ticking`, whenever the tab comes
 * back into view, and on `refresh()`. A hidden tab's timers are slowed, so nothing may rely on the ticks: see
 * `useWake`.
 */
export function useClock(ticking: boolean) {
  const [now, setNow] = useState(0)
  const refresh = useCallback(() => setNow(Date.now()), [])
  useEffect(() => {
    refresh()
    const back = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [refresh])
  useEffect(() => {
    if (!ticking) return undefined
    refresh()
    const timer = window.setInterval(refresh, 1000)
    return () => window.clearInterval(timer)
  }, [ticking, refresh])
  return { now, refresh }
}

/**
 * Calls `wake` at the epoch ms `at`. One timeout, not a ticking interval: Chrome lets a lone timeout in a hidden
 * tab fire about on time, while chained ones are held to once a minute. It is set again when the tab comes back,
 * which also covers a computer that slept.
 */
export function useWake(at: number | null, wake: () => void) {
  useEffect(() => {
    if (at === null) return undefined
    let timer = 0
    const arm = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(
        () => {
          wake()
          if (Date.now() < at) arm()
        },
        Math.max(0, at - Date.now()),
      )
    }
    const back = () => {
      if (!document.hidden) arm()
    }
    arm()
    document.addEventListener('visibilitychange', back)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', back)
    }
  }, [at, wake])
}
