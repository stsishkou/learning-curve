import { CHAPTERS, type ChapterId, PARTS } from '@lc/docs-contract'
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink } from '@lc/ui'
import { Link } from '@tanstack/react-router'
import { type ReactNode, Suspense } from 'react'

import { useDocsEnv } from '../app/env'
import { partColor } from '../app/part-color'
import type { Syllabus } from '../content/syllabus/types'
import { m } from '../paraglide/messages'
import { Checkpoint } from './Checkpoint'
import { DecisionCard } from './DecisionCard'
import { InlineText } from './InlineText'
import { CommitLink, FileLink } from './SourceLinks'
import { StoryList } from './Story'
import { Terminal } from './Terminal'

interface Props {
  chapterId: ChapterId
  syllabus: Syllabus | null
  /** The chapter's MDX, already chosen for the reader's language */
  prose: ReactNode
  /** Shown above the content when it is in another language than the reader's */
  notice?: ReactNode
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-24 flex-col gap-3">
      <h2 id={`${id}-title`} className="font-display text-xl">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="lc-list">
      {items.map((item) => (
        <li key={item}>
          <InlineText text={item} />
        </li>
      ))}
    </ul>
  )
}

/**
 * A chapter in the order of the chapter template: where we are, the problem, the decisions with their options, the
 * technology they bring, the story and the implementation with real files, a checkpoint, the trade-offs, what next.
 */
export function ChapterView({ chapterId, syllabus, prose, notice }: Props) {
  const { locale, mode } = useDocsEnv()
  const index = CHAPTERS.findIndex((entry) => entry.id === chapterId)
  const chapter = CHAPTERS[index]
  if (!chapter) return null
  const part = PARTS.find((entry) => entry.id === chapter.part)
  const previous = CHAPTERS[index - 1]
  const next = CHAPTERS[index + 1]
  const t = {
    where: m.section_where_we_are({}, { locale }),
    problem: m.section_problem({}, { locale }),
    outcomes: m.section_outcomes({}, { locale }),
    decisions: m.section_decisions({}, { locale }),
    concepts: m.section_concepts({}, { locale }),
    story: m.section_story({}, { locale }),
    implementation: m.section_implementation({}, { locale }),
    stories: m.section_stories({}, { locale }),
    checkpoint: m.section_checkpoint({}, { locale }),
    pitfalls: m.section_pitfalls({}, { locale }),
    tradeoffs: m.section_tradeoffs({}, { locale }),
    links: m.section_links({}, { locale }),
    next: m.section_next({}, { locale }),
  }
  const toc = [
    { id: 'where', title: t.where, shown: Boolean(syllabus) },
    { id: 'problem', title: t.problem, shown: Boolean(syllabus) },
    { id: 'decisions', title: t.decisions, shown: Boolean(syllabus) },
    { id: 'concepts', title: t.concepts, shown: Boolean(syllabus) },
    { id: 'story', title: t.story, shown: Boolean(prose) },
    { id: 'implementation', title: t.implementation, shown: Boolean(syllabus) },
    { id: 'stories', title: t.stories, shown: chapter.stories.length > 0 },
    { id: 'checkpoint', title: t.checkpoint, shown: Boolean(syllabus) },
    { id: 'tradeoffs', title: t.tradeoffs, shown: Boolean(syllabus) },
    { id: 'links', title: t.links, shown: Boolean(syllabus) },
  ].filter((entry) => entry.shown)

  return (
    // Container queries, not media queries: inside a host's drawer the viewport says nothing about the room we have.
    <div className="@container" style={partColor(part?.color ?? 'var(--focus)')}>
      <div className="grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_14rem]">
        <article className="flex min-w-0 flex-col gap-10" data-pagefind-body>
          <header className="flex flex-col gap-3 border-l-4 border-(--part) pl-4">
            <p className="text-sm font-semibold text-(--part)" data-pagefind-ignore>
              {part && `${m.part_label({ number: part.number }, { locale })} · ${part.title} · `}
              {m.chapter_label({ number: chapter.number }, { locale })} ·{' '}
              {m.minutes({ count: chapter.minutes }, { locale })}
            </p>
            <h1 className="font-display text-3xl leading-tight text-balance md:text-4xl">{chapter.title}</h1>
            {syllabus && (
              <p className="text-lg text-muted">
                <InlineText text={syllabus.summary} />
              </p>
            )}
            {chapter.commits.length > 0 && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted" data-pagefind-ignore>
                {m.chapter_commits({}, { locale })}:
                {chapter.commits.map((sha) => (
                  <CommitLink key={sha} sha={sha} />
                ))}
              </p>
            )}
          </header>

          {notice}

          {syllabus ? (
            <>
              <Section id="where" title={t.where}>
                <p>
                  <InlineText text={syllabus.whereWeAre} />
                </p>
              </Section>
              <Section id="problem" title={t.problem}>
                <p>
                  <InlineText text={syllabus.problem} />
                </p>
                <div className="lc-card p-4">
                  <h3 className="mb-2 font-semibold">{t.outcomes}</h3>
                  <Bullets items={syllabus.outcomes} />
                </div>
              </Section>
              <Section id="decisions" title={t.decisions}>
                {syllabus.decisions.map((decision) => (
                  <DecisionCard key={decision.question} decision={decision} />
                ))}
              </Section>
              <Section id="concepts" title={t.concepts}>
                <dl className="grid gap-3 @2xl:grid-cols-2">
                  {syllabus.concepts.map((concept) => (
                    <div key={concept.term} className="lc-card flex flex-col gap-1.5 p-4">
                      <dt className="font-semibold">
                        <InlineText text={concept.term} />
                      </dt>
                      <dd className="flex flex-col gap-2 text-sm">
                        <span>
                          <InlineText text={concept.explanation} />
                        </span>
                        {concept.link && (
                          <a className="lc-link inline-flex w-fit items-center gap-1" href={concept.link.href}>
                            {concept.link.label}
                            <ExternalLink aria-hidden size={12} />
                          </a>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Section>
            </>
          ) : (
            <p className="lc-card p-4 text-muted">{m.chapter_not_written({}, { locale })}</p>
          )}

          {prose && (
            <Section id="story" title={t.story}>
              <div className="lc-prose">
                <Suspense fallback={<p className="text-muted">{m.loading({}, { locale })}</p>}>{prose}</Suspense>
              </div>
            </Section>
          )}

          {syllabus && (
            <Section id="implementation" title={t.implementation}>
              <ol className="flex flex-col gap-4">
                {syllabus.steps.map((step, stepIndex) => (
                  <li key={step.title} className="lc-card flex flex-col gap-3 p-4">
                    <h3 className="flex items-baseline gap-2 font-semibold">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--part) text-xs text-surface">
                        {stepIndex + 1}
                      </span>
                      <InlineText text={step.title} />
                    </h3>
                    <p>
                      <InlineText text={step.detail} />
                    </p>
                    {step.commands && step.commands.length > 0 && <Terminal commands={step.commands} />}
                    {step.files.length > 0 && (
                      <ul className="flex flex-col gap-2">
                        {step.files.map((file) => (
                          <FileLink key={`${file.path}:${file.lines?.join('-') ?? ''}`} file={file} />
                        ))}
                      </ul>
                    )}
                    {step.commit && (
                      <p className="text-sm text-muted">
                        {m.chapter_commits({}, { locale })}: <CommitLink sha={step.commit} />
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {chapter.stories.length > 0 && (
            <Section id="stories" title={t.stories}>
              <StoryList ids={chapter.stories} />
            </Section>
          )}

          {syllabus && (
            <>
              <Section id="checkpoint" title={t.checkpoint}>
                <Checkpoint checkpoint={syllabus.checkpoint} />
              </Section>
              <Section id="tradeoffs" title={t.tradeoffs}>
                <Bullets items={syllabus.tradeoffs} />
                {syllabus.pitfalls.length > 0 && (
                  <div className="lc-card border-today/40 p-4">
                    <h3 className="mb-2 font-semibold">{t.pitfalls}</h3>
                    <Bullets items={syllabus.pitfalls} />
                  </div>
                )}
              </Section>
              <Section id="links" title={t.links}>
                <ul className="lc-list">
                  {syllabus.links.map((link) => (
                    <li key={link.href}>
                      <a className="lc-link" href={link.href}>
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section id="next" title={t.next}>
                <p className="flex items-start gap-2">
                  <ArrowRight aria-hidden size={18} className="mt-1 shrink-0 text-(--part)" />
                  <InlineText text={syllabus.next} />
                </p>
              </Section>
            </>
          )}

          <nav className="grid gap-3 @xl:grid-cols-2" aria-label={t.next} data-pagefind-ignore>
            {previous ? (
              <Link
                to="/$locale/chapters/$chapterId/"
                params={{ locale, chapterId: previous.id }}
                className="lc-card flex items-center gap-2 p-3 hover:bg-surface-2"
              >
                <ChevronLeft aria-hidden size={18} className="shrink-0 text-muted" />
                <span className="flex flex-col">
                  <span className="text-xs text-muted">{m.prev({}, { locale })}</span>
                  <span className="font-semibold">{previous.title}</span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                to="/$locale/chapters/$chapterId/"
                params={{ locale, chapterId: next.id }}
                className="lc-card flex items-center justify-end gap-2 p-3 text-right hover:bg-surface-2"
              >
                <span className="flex flex-col">
                  <span className="text-xs text-muted">{m.next({}, { locale })}</span>
                  <span className="font-semibold">{next.title}</span>
                </span>
                <ChevronRight aria-hidden size={18} className="shrink-0 text-muted" />
              </Link>
            )}
          </nav>
        </article>

        {/* Anchors would change the host's URL, so the table of contents is the site's only. */}
        {mode === 'site' && (
          <aside className="@max-5xl:hidden" data-pagefind-ignore>
            <nav
              className="sticky top-[calc(var(--lc-sticky-top,0px)+1rem)] flex flex-col gap-1 text-sm"
              aria-label={m.on_this_page({}, { locale })}
            >
              <span className="mb-1 font-semibold text-muted">{m.on_this_page({}, { locale })}</span>
              {toc.map(({ id, title }) => (
                <a key={id} href={`#${id}`} className="rounded px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink">
                  {title}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>
    </div>
  )
}
