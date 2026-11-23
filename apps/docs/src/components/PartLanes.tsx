import { CHAPTERS, PARTS } from '@lc/docs-contract'
import { Link } from '@tanstack/react-router'

import { useLocale } from '../app/env'
import { partColor } from '../app/part-color'
import { chapterTitle, partTitle } from '../content/titles'
import { m } from '../paraglide/messages'

/**
 * The route through the guide: one lane per part, the chapters in reading order, each with its length and the
 * commits it follows. It doubles as the growth timeline: the commits run from the first one to the pinned one.
 */
export function PartLanes() {
  const locale = useLocale()
  return (
    <ol className="flex flex-col gap-6">
      {PARTS.map((part) => {
        const chapters = CHAPTERS.filter((chapter) => chapter.part === part.id)
        return (
          <li key={part.id} className="grid gap-3 md:grid-cols-[13rem_minmax(0,1fr)]" style={partColor(part.color)}>
            <div className="flex flex-col gap-1 border-l-4 border-(--part) pl-3">
              <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                {m.part_label({ number: part.number }, { locale })}
              </span>
              <h3 className="font-display text-lg leading-tight">{partTitle(part.id, locale)}</h3>
              <span className="text-sm text-muted">{m.chapters_count({ count: chapters.length }, { locale })}</span>
            </div>
            <ol className="sm:grid-cols-2 xl:grid-cols-3 grid gap-2">
              {chapters.map((chapter) => (
                <li key={chapter.id}>
                  <Link
                    to="/$locale/chapters/$chapterId/"
                    params={{ locale, chapterId: chapter.id }}
                    className="lc-card group flex h-full flex-col gap-1.5 p-3 transition-colors hover:border-(--part)"
                  >
                    <span className="flex items-center justify-between text-xs text-muted">
                      <span className="font-semibold text-(--part)">
                        {m.chapter_label({ number: chapter.number }, { locale })}
                      </span>
                      <span>{m.minutes({ count: chapter.minutes }, { locale })}</span>
                    </span>
                    <span className="font-semibold group-hover:underline">{chapterTitle(chapter.id, locale)}</span>
                    {chapter.commits.length > 0 && (
                      <span className="mt-auto flex flex-wrap gap-1 pt-1" translate="no">
                        {chapter.commits.slice(0, 4).map((sha) => (
                          <code key={sha} className="rounded bg-surface-2 px-1 font-mono text-[11px] text-muted">
                            {sha}
                          </code>
                        ))}
                        {chapter.commits.length > 4 && (
                          <span className="text-[11px] text-muted">+{chapter.commits.length - 4}</span>
                        )}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          </li>
        )
      })}
    </ol>
  )
}
