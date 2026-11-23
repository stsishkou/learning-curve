import { CHAPTERS, type ChapterId } from '@lc/docs-contract'
import { ExternalLink } from '@lc/ui'
import { Link, createFileRoute } from '@tanstack/react-router'

import { localizedLinks } from '../../app/head'
import { asLocale } from '../../app/locale'
import { FallbackNotice } from '../../components/FallbackNotice'
import { InlineText } from '../../components/InlineText'
import { loadSyllabi } from '../../content/load'
import type { Concept } from '../../content/syllabus/types'
import { m } from '../../paraglide/messages'

interface Term {
  concept: Concept
  chapterId: ChapterId
  number: number
}

const anchor = (term: string) =>
  term
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')

export const Route = createFileRoute('/$locale/glossary')({
  loader: async (): Promise<Term[]> => {
    const syllabi = await loadSyllabi()
    const seen = new Set<string>()
    const terms: Term[] = []
    // A term belongs to the first chapter that needs it; later chapters may explain it again in their context.
    for (const chapter of CHAPTERS) {
      for (const concept of syllabi.find((syllabus) => syllabus.id === chapter.id)?.concepts ?? []) {
        const key = concept.term.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        terms.push({ concept, chapterId: chapter.id, number: chapter.number })
      }
    }
    return terms.toSorted((a, b) =>
      a.concept.term.replaceAll('`', '').localeCompare(b.concept.term.replaceAll('`', ''), 'en'),
    )
  },
  head: ({ params }) => {
    const locale = asLocale(params.locale)
    return {
      meta: [{ title: `${m.glossary_title({}, { locale })} — Learning Curve` }],
      links: localizedLinks(locale, 'glossary/'),
    }
  },
  component: Glossary,
})

function Glossary() {
  const locale = asLocale(Route.useParams().locale)
  const terms = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6" data-pagefind-body>
      <header className="flex max-w-3xl flex-col gap-3">
        <h1 className="font-display text-3xl">{m.glossary_title({}, { locale })}</h1>
        <p className="text-muted">{m.glossary_lead({}, { locale })}</p>
      </header>
      {locale !== 'en' && <FallbackNotice />}
      <dl className="grid gap-3 @3xl:grid-cols-2">
        {terms.map(({ concept, chapterId, number }) => (
          <div key={concept.term} id={anchor(concept.term)} className="lc-card flex scroll-mt-24 flex-col gap-2 p-4">
            <dt className="font-semibold">
              <InlineText text={concept.term} />
            </dt>
            <dd className="flex flex-col gap-2 text-sm">
              <span>
                <InlineText text={concept.explanation} />
              </span>
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                <Link to="/$locale/chapters/$chapterId/" params={{ locale, chapterId }} className="lc-link">
                  {m.glossary_first({ number }, { locale })}
                </Link>
                {concept.link && (
                  <a className="lc-link inline-flex items-center gap-1" href={concept.link.href}>
                    {concept.link.label}
                    <ExternalLink aria-hidden size={12} />
                  </a>
                )}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
