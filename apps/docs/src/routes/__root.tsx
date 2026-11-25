import { DOCS_DEFAULT_LOCALE, isDocsLocale } from '@lc/docs-contract'
import { HeadContent, Link, Outlet, Scripts, createRootRoute, useParams } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { THEME_BOOT_SCRIPT } from '../app/theme'
import { m } from '../paraglide/messages'

import siteCss from '../styles/site.css?url'

const ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#2f5bea"/><path d="M6 25C12 24 14 8 26 7" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>',
)}`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'color-scheme', content: 'light dark' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Unbounded:wght@500;700&display=swap',
      },
      { rel: 'stylesheet', href: siteCss },
      { rel: 'icon', href: ICON },
    ],
    scripts: [{ children: THEME_BOOT_SCRIPT }],
  }),
  shellComponent: RootDocument,
  component: Outlet,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: ReactNode }) {
  const locale = useParams({ strict: false, select: (params) => params.locale })
  return (
    <html lang={locale && isDocsLocale(locale) ? locale : DOCS_DEFAULT_LOCALE} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  const raw = useParams({ strict: false, select: (params) => params.locale })
  const locale = raw && isDocsLocale(raw) ? raw : DOCS_DEFAULT_LOCALE
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-lg">{m.not_found({}, { locale })}</p>
      <Link to="/$locale/" params={{ locale }} className="lc-link">
        {m.back_home({}, { locale })}
      </Link>
    </main>
  )
}
