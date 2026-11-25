import { isChapterId } from '@lc/docs-contract'
import { Link } from '@tanstack/react-router'
import { type ReactNode, use } from 'react'

import { useLocale } from '../app/env'
import { chapterTitle } from '../content/titles'
import { ProseLocaleContext } from './prose-locale'

/**
 * A link from prose to another chapter. A router link, not `<a href>`: inside a host's drawer a plain link would
 * navigate the host page. The title is in the language of the prose around it; the page it opens is in the reader's.
 * An unknown id throws, which fails the pre-render instead of shipping a dead link.
 */
export function ChapterLink({ id, children }: { id: string; children?: ReactNode | undefined }) {
  const locale = useLocale()
  const textLocale = use(ProseLocaleContext) ?? locale
  if (!isChapterId(id)) throw new Error(`<ChapterLink id="${id}">: no such chapter`)
  return (
    <Link to="/$locale/chapters/$chapterId/" params={{ locale, chapterId: id }} className="lc-link">
      {children ?? chapterTitle(id, textLocale)}
    </Link>
  )
}
