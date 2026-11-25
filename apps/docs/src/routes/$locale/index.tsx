import { CHAPTERS } from '@lc/docs-contract'
import { ArrowRight } from '@lc/ui'
import { Link, createFileRoute } from '@tanstack/react-router'

import { localizedLinks } from '../../app/head'
import { asLocale } from '../../app/locale'
import { ArchitectureMap } from '../../components/ArchitectureMap'
import { PartLanes } from '../../components/PartLanes'
import { m } from '../../paraglide/messages'

const FIRST = CHAPTERS[0].id

export const Route = createFileRoute('/$locale/')({
  head: ({ params }) => ({ links: localizedLinks(asLocale(params.locale), '') }),
  component: Home,
})

function Home() {
  const locale = asLocale(Route.useParams().locale)
  return (
    <div className="flex flex-col gap-12" data-pagefind-body>
      <section className="flex max-w-3xl flex-col gap-4">
        <h1 className="font-display text-3xl leading-tight text-balance md:text-5xl">{m.home_title({}, { locale })}</h1>
        <p className="text-lg text-muted">{m.home_lead({}, { locale })}</p>
        <Link
          to="/$locale/chapters/$chapterId/"
          params={{ locale, chapterId: FIRST }}
          className="inline-flex w-fit items-center gap-2 rounded-[10px] border border-ink bg-ink px-4 py-2 font-medium text-bg hover:opacity-90"
        >
          {m.home_start({}, { locale })}
          <ArrowRight aria-hidden size={16} />
        </Link>
      </section>
      <section className="flex flex-col gap-4" aria-labelledby="route-title">
        <h2 id="route-title" className="font-display text-2xl">
          {m.home_timeline({}, { locale })}
        </h2>
        <PartLanes />
      </section>
      <section className="flex flex-col gap-4" aria-labelledby="map-title" data-pagefind-ignore>
        <h2 id="map-title" className="font-display text-2xl">
          {m.home_map({}, { locale })}
        </h2>
        <ArchitectureMap />
      </section>
    </div>
  )
}
