import { Check } from '@lc/ui'
import type { ReactNode } from 'react'

import { useLocale } from '../app/env'
import type { Decision } from '../content/syllabus/types'
import { m } from '../paraglide/messages'
import { EvidenceTag } from './EvidenceTag'
import { InlineText } from './InlineText'
import { SourceItem } from './SourceLinks'

interface Props {
  decision: Decision
  /** A line above the question, such as the chapter the decision comes from in the decision log */
  context?: ReactNode
  headingLevel?: 'h2' | 'h3'
}

/**
 * One question, the options that were on the table with what speaks for and against each, the one taken and why.
 * The evidence tag says whether that "why" is recorded in the repository or reconstructed.
 */
export function DecisionCard({ decision, context, headingLevel: Heading = 'h3' }: Props) {
  const locale = useLocale()
  return (
    <article className="lc-card flex flex-col gap-4 p-4 md:p-5" data-pagefind-weight="2">
      <header className="flex flex-col gap-2">
        {context && <div className="text-sm text-muted">{context}</div>}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Heading className="text-lg font-semibold text-balance">
            <InlineText text={decision.question} />
          </Heading>
          <EvidenceTag evidence={decision.evidence} />
        </div>
      </header>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(15rem,100%),1fr))] gap-3">
        {decision.options.map((option) => {
          const chosen = option.name === decision.chosen
          return (
            <li
              key={option.name}
              className={`flex flex-col gap-2 rounded-xl border p-3 ${chosen ? 'border-focus bg-focus/5' : 'border-line'}`}
              aria-current={chosen || undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  <InlineText text={option.name} />
                </span>
                {chosen && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-focus px-2 py-0.5 text-xs font-semibold text-surface">
                    <Check aria-hidden size={12} />
                    {m.decision_chosen({}, { locale })}
                  </span>
                )}
              </div>
              <ProsCons label={m.decision_pros({}, { locale })} items={option.pros} sign="+" />
              <ProsCons label={m.decision_cons({}, { locale })} items={option.cons} sign="−" />
            </li>
          )
        })}
      </ul>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-muted">{m.decision_why({}, { locale })}</p>
        <p>
          <InlineText text={decision.why} />
        </p>
      </div>
      {decision.sources.length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold text-muted">{m.decision_sources({}, { locale })}</p>
          <ul className="flex flex-col gap-1">
            {decision.sources.map((source) => (
              <SourceItem key={`${source.kind}:${source.ref}`} source={source} />
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

function ProsCons({ label, items, sign }: { label: string; items: readonly string[]; sign: string }) {
  if (!items.length) return null
  return (
    <div className="text-sm">
      <span className="sr-only">{label}:</span>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span
              aria-hidden
              className={`w-3 shrink-0 font-semibold ${sign === '+' ? 'text-done-ink' : 'text-today-ink'}`}
            >
              {sign}
            </span>
            <span>
              <InlineText text={item} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
