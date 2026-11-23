import { DOCS_SOURCE_LOCALE } from '@lc/docs-contract'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { localizedLinks } from '../../app/head'
import { asLocale } from '../../app/locale'
import { FallbackNotice } from '../../components/FallbackNotice'
import { Prose } from '../../components/Prose'
import { preloadProse, proseLocale } from '../../content/load'
import { m } from '../../paraglide/messages'

const SLUG = 'integration'

export const Route = createFileRoute('/$locale/integration')({
  loader: async ({ params }) => {
    const prose = proseLocale(asLocale(params.locale), SLUG) ?? DOCS_SOURCE_LOCALE
    await preloadProse(prose, SLUG)
    return { prose }
  },
  head: ({ params }) => {
    const locale = asLocale(params.locale)
    return {
      meta: [{ title: `${m.nav_integration({}, { locale })} — Learning Curve` }],
      links: localizedLinks(locale, 'integration/'),
    }
  },
  component: Integration,
})

function Integration() {
  const locale = asLocale(Route.useParams().locale)
  const { prose } = Route.useLoaderData()
  return (
    <article className="flex max-w-4xl flex-col gap-6" data-pagefind-body>
      {prose !== locale && <FallbackNotice />}
      <div className="lc-prose">
        <Suspense fallback={<p className="text-muted">{m.loading({}, { locale })}</p>}>
          <Prose locale={prose} slug={SLUG} />
        </Suspense>
      </div>
    </article>
  )
}
