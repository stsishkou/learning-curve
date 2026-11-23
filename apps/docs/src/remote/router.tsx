// The drawer's own router. Its history lives in memory: the guide navigates between chapters without touching the
// host's URL, its back button or its router. The paths are the site's, so the shared components' links work in both.
import { CHAPTERS, type DocsLocale, type FeatureId, PARTS, chaptersForFeature, isChapterId } from '@lc/docs-contract'
import { Link, Outlet, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { createContext, use } from 'react'

import { useLocale } from '../app/env'
import { asLocale, missing } from '../app/locale'
import { ChapterView } from '../components/ChapterView'
import { FallbackNotice } from '../components/FallbackNotice'
import { Prose } from '../components/Prose'
import { loadSyllabus, preloadProse, proseLocale } from '../content/load'
import { chapterTitle, partTitle } from '../content/titles'
import { m } from '../paraglide/messages'

/** The screen the host says the person is on. */
export const TopicContext = createContext<FeatureId | undefined>(undefined)

const rootRoute = createRootRoute({ component: Outlet })

const localeRoute = createRoute({ getParentRoute: () => rootRoute, path: '$locale', component: Outlet })

const topicsRoute = createRoute({ getParentRoute: () => localeRoute, path: '/', component: Topics })

const chapterRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'chapters/$chapterId',
  loader: async ({ params }) => {
    if (!isChapterId(params.chapterId)) return missing()
    const prose = proseLocale(asLocale(params.locale), params.chapterId)
    const [syllabus] = await Promise.all([
      loadSyllabus(params.chapterId),
      prose ? preloadProse(prose, params.chapterId) : null,
    ])
    return { syllabus, prose }
  },
  component: Chapter,
})

const routeTree = rootRoute.addChildren([localeRoute.addChildren([topicsRoute, chapterRoute])])

export function createHelpRouter(locale: DocsLocale) {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [`/${locale}/`] }),
    trailingSlash: 'always',
    defaultPendingMs: 150,
  })
}

export type HelpRouter = ReturnType<typeof createHelpRouter>

function ChapterLinks({ ids }: { ids: readonly string[] }) {
  const locale = useLocale()
  return (
    <ul className="flex flex-col gap-1.5">
      {CHAPTERS.filter((chapter) => ids.includes(chapter.id)).map((chapter) => (
        <li key={chapter.id}>
          <Link
            to="/$locale/chapters/$chapterId/"
            params={{ locale, chapterId: chapter.id }}
            className="lc-card flex items-baseline gap-3 p-3 hover:bg-surface-2"
          >
            <span className="w-6 shrink-0 text-right text-sm font-semibold text-muted tabular-nums">
              {chapter.number}
            </span>
            <span className="font-semibold">{chapterTitle(chapter.id, locale)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Topics() {
  const locale = useLocale()
  const topic = use(TopicContext)
  const related = topic ? chaptersForFeature(topic).map((chapter) => chapter.id) : []
  return (
    <div className="flex flex-col gap-6">
      {topic && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg">{m.help_for_screen({}, { locale })}</h2>
          <p className="font-mono text-xs text-muted" translate="no">
            {topic}
          </p>
          {related.length ? (
            <ChapterLinks ids={related} />
          ) : (
            <p className="text-muted">{m.help_nothing({}, { locale })}</p>
          )}
        </section>
      )}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg">{m.help_all({}, { locale })}</h2>
        {PARTS.map((part) => (
          <div key={part.id} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted">
              {m.part_label({ number: part.number }, { locale })} · {partTitle(part.id, locale)}
            </h3>
            <ChapterLinks ids={CHAPTERS.filter((chapter) => chapter.part === part.id).map((chapter) => chapter.id)} />
          </div>
        ))}
      </section>
    </div>
  )
}

function Chapter() {
  const locale = useLocale()
  const { chapterId } = chapterRoute.useParams()
  const { syllabus, prose } = chapterRoute.useLoaderData()
  if (!isChapterId(chapterId)) return null
  return (
    <ChapterView
      chapterId={chapterId}
      syllabus={syllabus}
      prose={prose ? <Prose locale={prose} slug={chapterId} /> : null}
      notice={locale === 'en' ? null : <FallbackNotice />}
    />
  )
}
