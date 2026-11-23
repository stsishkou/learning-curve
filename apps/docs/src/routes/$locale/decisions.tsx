import { CHAPTERS, type ChapterId } from '@lc/docs-contract'
import { Segmented } from '@lc/ui'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { localizedLinks } from '../../app/head'
import { asLocale } from '../../app/locale'
import { DecisionCard } from '../../components/DecisionCard'
import { FallbackNotice } from '../../components/FallbackNotice'
import { loadSyllabi } from '../../content/load'
import type { Decision, Evidence } from '../../content/syllabus/types'
import { m } from '../../paraglide/messages'

interface LoggedDecision {
  chapterId: ChapterId
  number: number
  title: string
  decision: Decision
}

export const Route = createFileRoute('/$locale/decisions')({
  loader: async (): Promise<LoggedDecision[]> => {
    const syllabi = await loadSyllabi()
    return CHAPTERS.flatMap((chapter) =>
      (syllabi.find((syllabus) => syllabus.id === chapter.id)?.decisions ?? []).map((decision) => ({
        chapterId: chapter.id,
        number: chapter.number,
        title: chapter.title,
        decision,
      })),
    )
  },
  head: ({ params }) => {
    const locale = asLocale(params.locale)
    return {
      meta: [{ title: `${m.decisions_title({}, { locale })} — Learning Curve` }],
      links: localizedLinks(locale, 'decisions/'),
    }
  },
  component: DecisionLog,
})

type Filter = 'all' | Evidence

function DecisionLog() {
  const locale = asLocale(Route.useParams().locale)
  const decisions = Route.useLoaderData()
  const [filter, setFilter] = useState<Filter>('all')
  const shown = decisions.filter((entry) => filter === 'all' || entry.decision.evidence === filter)
  return (
    <div className="flex flex-col gap-6" data-pagefind-body>
      <header className="flex max-w-3xl flex-col gap-3">
        <h1 className="font-display text-3xl">{m.decisions_title({}, { locale })}</h1>
        <p className="text-muted">{m.decisions_lead({}, { locale })}</p>
      </header>
      {locale !== 'en' && <FallbackNotice />}
      <div className="flex items-center gap-3" data-pagefind-ignore>
        <span className="text-sm text-muted">{m.decisions_filter({}, { locale })}</span>
        <Segmented<Filter>
          label={m.decisions_filter({}, { locale })}
          value={filter}
          options={[
            { value: 'all', label: `${m.decisions_all({}, { locale })} · ${decisions.length}` },
            { value: 'evidenced', label: m.evidence_evidenced({}, { locale }) },
            { value: 'inferred', label: m.evidence_inferred({}, { locale }) },
          ]}
          onChange={setFilter}
        />
      </div>
      <ol className="flex flex-col gap-4">
        {shown.map((entry) => (
          <li key={`${entry.chapterId}:${entry.decision.question}`}>
            <DecisionCard
              decision={entry.decision}
              headingLevel="h2"
              context={
                <Link
                  to="/$locale/chapters/$chapterId/"
                  params={{ locale, chapterId: entry.chapterId }}
                  className="lc-link"
                >
                  {m.decision_in_chapter({ number: entry.number, title: entry.title }, { locale })}
                </Link>
              }
            />
          </li>
        ))}
      </ol>
    </div>
  )
}
