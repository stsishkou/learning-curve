import { DOCS_SOURCE_LOCALE, isChapterId } from '@lc/docs-contract'
import { createFileRoute } from '@tanstack/react-router'

import { localizedLinks } from '../../../app/head'
import { asLocale, missing } from '../../../app/locale'
import { ChapterView } from '../../../components/ChapterView'
import { FallbackNotice } from '../../../components/FallbackNotice'
import { Prose } from '../../../components/Prose'
import { loadSyllabus, preloadProse, proseLocale } from '../../../content/load'
import { chapterTitle } from '../../../content/titles'
import { chapterSection } from '../../../site-paths'

export const Route = createFileRoute('/$locale/chapters/$chapterId')({
  beforeLoad: ({ params }) => {
    if (!isChapterId(params.chapterId)) missing()
  },
  loader: async ({ params }) => {
    if (!isChapterId(params.chapterId)) return missing()
    const locale = asLocale(params.locale)
    const prose = proseLocale(locale, params.chapterId)
    const [syllabus] = await Promise.all([
      loadSyllabus(params.chapterId),
      prose ? preloadProse(prose, params.chapterId) : null,
    ])
    return { syllabus, prose }
  },
  head: ({ params, loaderData }) => {
    const locale = asLocale(params.locale)
    const title = isChapterId(params.chapterId) ? chapterTitle(params.chapterId, locale) : ''
    return {
      meta: [
        { title: `${title} — Learning Curve` },
        ...(loaderData?.syllabus
          ? [{ name: 'description', content: loaderData.syllabus.summary.replaceAll('`', '') }]
          : []),
      ],
      links: localizedLinks(locale, chapterSection(params.chapterId)),
    }
  },
  component: ChapterPage,
})

function ChapterPage() {
  const params = Route.useParams()
  const { syllabus, prose } = Route.useLoaderData()
  const locale = asLocale(params.locale)
  if (!isChapterId(params.chapterId)) return null
  // The syllabus is written in English first; prose may exist in the reader's language before it.
  const translated = locale === DOCS_SOURCE_LOCALE || (prose === locale && syllabus === null)
  return (
    <ChapterView
      chapterId={params.chapterId}
      syllabus={syllabus}
      prose={prose ? <Prose locale={prose} slug={params.chapterId} /> : null}
      notice={translated ? null : <FallbackNotice />}
    />
  )
}
