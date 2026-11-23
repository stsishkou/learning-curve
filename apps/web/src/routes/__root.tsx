import { m } from '@lc/i18n/messages'
import { getLocale, localizeHref } from '@lc/i18n/runtime'
import { ICONS_ONLY_BOOT, Tooltips } from '@lc/ui'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'

import { type DocsConfig, getDocsConfig } from '#/server/docs'
import { getPlanRevision } from '#/server/plan'
import { FollowPlan } from '#/shell/FollowPlan'
import { THEME_BOOT_SCRIPT } from '#/shell/theme'
import { TodayIcon, todayIcon } from '#/shell/TodayIcon'

import appCss from '../styles.css?url'

let docsAddress: Promise<DocsConfig> | undefined
const docsConfig = () => (docsAddress ??= getDocsConfig())

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'color-scheme', content: 'light dark' },
      { title: m.meta_title() },
      { name: 'description', content: m.meta_description() },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Unbounded:wght@500;700&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: todayIcon() },
    ],
    scripts: [{ children: THEME_BOOT_SCRIPT }, { children: ICONS_ONLY_BOOT }],
  }),
  // Every page reads the plan again after a change of its own; this is the one it was loaded with, to notice the others.
  // The docs address is fixed for the life of the server, so it is asked once rather than on every reload.
  loader: async () => {
    const [revision, docs] = await Promise.all([getPlanRevision(), docsConfig()])
    return { revision, docs }
  },
  shellComponent: RootDocument,
  component: Root,
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

function Root() {
  return (
    <>
      <Outlet />
      <FollowPlan revision={Route.useLoaderData({ select: (data) => data.revision })} />
    </>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // The head script marks <html> for the icons-only mode before React takes the page over.
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TodayIcon />
        <Tooltips />
        <Scripts />
      </body>
    </html>
  )
}
