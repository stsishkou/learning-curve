import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { m } from '#/paraglide/messages.js'
import { getLocale, localizeHref } from '#/paraglide/runtime.js'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: m.meta_title() },
      { name: 'description', content: m.meta_description() },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Unbounded:wght@500;700&display=swap' },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🗓️</text></svg>' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="mx-auto max-w-[1240px] px-3 pt-3.5 pb-10 md:px-5 md:pt-5 md:pb-12">
      <p className="px-[18px] py-10 text-center text-muted">
        {m.not_found()}{' '}
        <a className="text-focus underline" href={localizeHref('/')}>
          {m.open_plan()}
        </a>
      </p>
    </div>
  ),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
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
