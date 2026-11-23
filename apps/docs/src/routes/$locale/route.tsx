import { CHAPTERS, PINNED_COMMIT, commitUrl } from '@lc/docs-contract'
import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'

import { type DocsEnv, DocsEnvContext } from '../../app/env'
import { asLocale, localeParam } from '../../app/locale'
import { SiteHeader } from '../../app/SiteHeader'
import { m } from '../../paraglide/messages'

const APPENDIX = CHAPTERS.at(-1)?.id ?? 'docs-remote'

export const Route = createFileRoute('/$locale')({
  beforeLoad: ({ params }) => {
    localeParam(params.locale)
  },
  head: ({ params }) => {
    const locale = asLocale(params.locale)
    return {
      meta: [
        { title: m.meta_title({}, { locale }) },
        { name: 'description', content: m.meta_description({}, { locale }) },
        { property: 'og:title', content: m.meta_title({}, { locale }) },
        { property: 'og:description', content: m.meta_description({}, { locale }) },
      ],
    }
  },
  component: LocaleLayout,
})

function LocaleLayout() {
  const locale = asLocale(Route.useParams().locale)
  const env = useMemo<DocsEnv>(
    () => ({ locale, site: import.meta.env.BASE_URL, stand: import.meta.env.VITE_STAND_URL, mode: 'site' }),
    [locale],
  )
  return (
    <DocsEnvContext value={env}>
      <a
        href="#content"
        className="sr-only z-50 rounded-lg bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {m.skip_to_content({}, { locale })}
      </a>
      <div className="mx-auto flex min-h-dvh max-w-[1240px] flex-col px-3 pt-3.5 pb-10 md:px-5 md:pt-5">
        <SiteHeader />
        <main id="content" tabIndex={-1} className="@container flex-1 pt-6 outline-none md:pt-8">
          <Outlet />
        </main>
        <footer className="mt-16 flex flex-wrap justify-between gap-3 border-t border-line-soft pt-4 text-sm text-muted">
          <span>
            {m.footer_pinned({ sha: PINNED_COMMIT.slice(0, 7) }, { locale })}{' '}
            <a className="lc-link" href={commitUrl(PINNED_COMMIT)} translate="no">
              {PINNED_COMMIT.slice(0, 7)}
            </a>
          </span>
          <Link to="/$locale/chapters/$chapterId/" params={{ locale, chapterId: APPENDIX }} className="lc-link">
            {m.footer_appendix({}, { locale })}
          </Link>
        </footer>
      </div>
    </DocsEnvContext>
  )
}
