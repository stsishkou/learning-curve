import { CHAPTERS, PARTS } from '@lc/docs-contract'
import { type MouseEvent, type ReactNode, useSyncExternalStore } from 'react'
import { NAVIGATE_URL } from 'storybook/internal/core-events'
import { addons } from 'storybook/preview-api'

import { getLocale, subscribe } from '../globals'
import { chapterHref, guideHref } from '../story/links'

// A plain link would load the address inside the preview frame; the manager has to do the navigation.
function open(e: MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  addons.getChannel().emit(NAVIGATE_URL, e.currentTarget.getAttribute('href'))
}

/** The guide's start page in the stand's language, in a new tab: inside the preview frame a link would load there. */
export function GuideLink({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getLocale)
  return (
    <a href={guideHref(locale)} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

/** Every chapter of the guide, part by part, with the stories that show what it built. */
export function StoryMap() {
  const locale = useSyncExternalStore(subscribe, getLocale)
  return (
    <div className="grid gap-6 font-sans text-[15px]/[1.5] text-ink">
      {PARTS.map((part) => (
        <section key={part.id}>
          <h3 className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
            Part {part.number} · {part.title}
          </h3>
          <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
            {CHAPTERS.filter((chapter) => chapter.part === part.id).map((chapter) => (
              <li
                key={chapter.id}
                className="grid gap-x-4 gap-y-1 border-b border-line-soft px-4 py-2.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              >
                <a
                  href={chapterHref(chapter, locale)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-focus hover:underline"
                >
                  {chapter.number}. {chapter.title} ↗
                </a>
                <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[14px]">
                  {chapter.stories.length > 0 ? (
                    chapter.stories.map((id) => (
                      <a key={id} href={`?path=/story/${id}`} onClick={open} className="text-focus hover:underline">
                        {id.replace(/--.*$/, '').replace(/^[a-z]+-(page|widgets|features|kit)-/, '')}
                      </a>
                    ))
                  ) : (
                    <span className="text-muted">tooling, no component</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
