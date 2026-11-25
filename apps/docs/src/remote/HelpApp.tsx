import type { DocsContext } from '@lc/docs-contract'
import { ChevronLeft, ExternalLink, X } from '@lc/ui'
import { RouterProvider, useRouterState } from '@tanstack/react-router'
import { useEffect, useMemo, useRef } from 'react'

import { type DocsEnv, DocsEnvContext } from '../app/env'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { m } from '../paraglide/messages'
import { type HelpRouter, TopicContext } from './router'

interface Props {
  router: HelpRouter
  context: DocsContext
  open: boolean
  onClose: () => void
  onError: (message: string) => void
}

const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`)

/**
 * The drawer: a modal <dialog> on the right, so focus stays inside it, Escape closes it and the host page is inert
 * behind it, all native. It renders the chapters through the drawer's memory router.
 */
export function HelpApp({ router, context, open, onClose, onError }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { locale } = context
  const site = withSlash(context.siteUrl ?? 'https://stsishkou.github.io/learning-curve/')
  const env = useMemo<DocsEnv>(() => ({ locale, site, stand: `${site}stand/`, mode: 'embedded' }), [locale, site])
  const pathname = useRouterState({ router, select: (state) => state.location.pathname })
  const home = pathname === `/${locale}/`

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <DocsEnvContext value={env}>
      <TopicContext value={context.featureId}>
        <dialog
          ref={dialog}
          lang={locale}
          aria-labelledby="lc-docs-title"
          className="backdrop:bg-black/40 fixed inset-y-0 right-0 left-auto m-0 flex h-dvh max-h-none w-[min(46rem,100vw)] max-w-none flex-col border-l border-line bg-bg p-0 text-ink shadow-2xl not-open:hidden motion-safe:open:animate-[lc-fade-in_200ms_ease-out]"
          onClose={onClose}
        >
          <header className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2.5">
            {!home && (
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
                aria-label={m.help_back({}, { locale })}
                onClick={() => router.history.back()}
              >
                <ChevronLeft aria-hidden size={18} />
              </button>
            )}
            <h1 id="lc-docs-title" className="mr-auto font-display text-base">
              {m.help_title({}, { locale })}
            </h1>
            <a
              href={`${site}${pathname.slice(1)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-focus hover:bg-surface-2"
            >
              {m.help_open_site({}, { locale })}
              <ExternalLink aria-hidden size={13} />
            </a>
            <button
              type="button"
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
              aria-label={m.help_close({}, { locale })}
              onClick={() => dialog.current?.close()}
            >
              <X aria-hidden size={18} />
            </button>
          </header>
          <div className="@container flex-1 overflow-y-auto px-4 py-5">
            <ErrorBoundary
              onError={(error) => onError(error instanceof Error ? error.message : String(error))}
              renderFallback={(retry) => (
                <div className="flex flex-col items-start gap-3">
                  <p>{m.error_title({}, { locale })}</p>
                  <div className="flex gap-3">
                    <button type="button" className="lc-link" onClick={retry}>
                      {m.error_retry({}, { locale })}
                    </button>
                    <a className="lc-link" href={site} target="_blank" rel="noreferrer">
                      {m.help_open_site({}, { locale })}
                    </a>
                  </div>
                </div>
              )}
            >
              <RouterProvider router={router} />
            </ErrorBoundary>
          </div>
        </dialog>
      </TopicContext>
    </DocsEnvContext>
  )
}
