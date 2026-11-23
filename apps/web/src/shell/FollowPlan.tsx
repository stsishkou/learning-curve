import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { getPlanRevision } from '#/server/plan'

// Asked rather than told: a watcher of the files would miss the writes editors and scripts make by renaming.
const EVERY = 2000

/**
 * Reads the plan again when it changed outside this page: in another tab or window, in the AI chat, through the MCP
 * server or a calendar sync. `revision` is the one the page was loaded with; null where nothing changes the plan.
 */
export function FollowPlan({ revision }: { revision: string | null }) {
  const router = useRouter()
  const asked = useRef(revision)
  useEffect(() => {
    let stopped = false
    const check = async () => {
      if (revision === null || document.visibilityState !== 'visible') return
      // The server may be away for a moment, as while it restarts: the next check asks again.
      const latest = await getPlanRevision().catch(() => null)
      if (stopped || latest === null || latest === revision || latest === asked.current) return
      asked.current = latest
      await router.invalidate()
    }
    const onShow = () => void check()
    const timer = window.setInterval(onShow, EVERY)
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('focus', onShow)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onShow)
      window.removeEventListener('focus', onShow)
    }
  }, [revision, router])
  return null
}
