import type { DocsContext, DocsEventName, DocsEvents, DocsHost, DocsTarget } from '@lc/docs-contract'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { DocsLoadFailure } from './load'

/** Where the drawer is: not asked for yet, loading the remote, open-able, or the remote could not be used. */
export type DocsStatus = 'idle' | 'loading' | 'ready' | 'failed'

/** What a host wants to hear from the drawer, by the contract's event names. */
export type DocsEventHandlers = { [K in DocsEventName]?: ((detail: DocsEvents[K]) => void) | undefined }

/** What `useDocsHost` needs from the host. */
export interface DocsHostOptions {
  /** The remote's `mf-manifest.json`. Read at run time, so one host build can point at any deployment. */
  manifestUrl: string
  context: DocsContext
  events?: DocsEventHandlers | undefined
  timeoutMs?: number | undefined
}

/** What `useDocsHost` gives back: the drawer's state and how to open or close it. */
export interface DocsHostState {
  status: DocsStatus
  /** Why the last load failed, for a host that wants to say more than "unavailable" */
  failure: DocsLoadFailure | null
  /** Loads the remote on first use, then opens the drawer; resolves false when the host should show its fallback */
  open(target: DocsTarget): Promise<boolean>
  close(): void
}

const FAILURES: readonly DocsLoadFailure[] = ['timeout', 'unavailable', 'shape', 'version']

// Read off the error rather than with `instanceof RemoteLoadError`: when the loader's own chunk fails to load, the
// class is not available either.
function failureOf(error: unknown): DocsLoadFailure {
  if (error instanceof Error && 'reason' in error)
    return FAILURES.find((reason) => reason === error.reason) ?? 'unavailable'
  return 'unavailable'
}

function subscribe(host: DocsHost, events: { current: DocsEventHandlers | undefined }): void {
  // Handlers are looked up when an event fires, so a host that passes a new object every render needs no resubscribe.
  host.on('docs:ready', (detail) => events.current?.['docs:ready']?.(detail))
  host.on('docs:open', (detail) => events.current?.['docs:open']?.(detail))
  host.on('docs:navigate', (detail) => events.current?.['docs:navigate']?.(detail))
  host.on('docs:close', (detail) => events.current?.['docs:close']?.(detail))
  host.on('docs:language-changed', (detail) => events.current?.['docs:language-changed']?.(detail))
  host.on('docs:error', (detail) => events.current?.['docs:error']?.(detail))
}

/**
 * The docs drawer for a React host. Nothing is fetched until `open` is first called; then the federation runtime,
 * the remote's manifest and its chunks load, and the drawer is created with the current context and kept until
 * unmount. Later context changes reach it through `update`.
 */
export function useDocsHost({ manifestUrl, context, events, timeoutMs }: DocsHostOptions): DocsHostState {
  const [status, setStatus] = useState<DocsStatus>('idle')
  const [failure, setFailure] = useState<DocsLoadFailure | null>(null)
  const host = useRef<DocsHost | null>(null)
  const pending = useRef<Promise<DocsHost> | null>(null)
  const unmounted = useRef(false)
  const latestContext = useRef(context)
  const latestEvents = useRef(events)
  useEffect(() => {
    latestContext.current = context
    latestEvents.current = events
  })

  const { locale, theme, featureId, siteUrl, tokens } = context
  const tokensKey = JSON.stringify(tokens ?? {})
  useEffect(() => {
    host.current?.update(latestContext.current)
  }, [locale, theme, featureId, siteUrl, tokensKey])

  useEffect(() => {
    unmounted.current = false
    return () => {
      unmounted.current = true
      host.current?.destroy()
      host.current = null
      pending.current = null
    }
  }, [])

  const ensureHost = useCallback((): Promise<DocsHost> => {
    pending.current ??= (async () => {
      const { loadDocsHelp } = await import('./load')
      const module = await loadDocsHelp({ manifestUrl, timeoutMs })
      const created = module.createDocsHost({ context: latestContext.current })
      if (unmounted.current) {
        created.destroy()
        throw new Error('The host unmounted while the docs were loading')
      }
      subscribe(created, latestEvents)
      host.current = created
      return created
    })()
    return pending.current
  }, [manifestUrl, timeoutMs])

  const open = useCallback(
    async (target: DocsTarget) => {
      if (!host.current) setStatus('loading')
      try {
        const ready = await ensureHost()
        ready.open(target)
        setStatus('ready')
        setFailure(null)
        return true
      } catch (err) {
        // A later click tries again: the remote may be back.
        pending.current = null
        if (unmounted.current) return false
        setFailure(failureOf(err))
        setStatus('failed')
        return false
      }
    },
    [ensureHost],
  )

  const close = useCallback(() => host.current?.close(), [])

  return { status, failure, open, close }
}
