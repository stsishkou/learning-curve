import type { DocsLocale } from '@lc/docs-contract'
import { createElement } from 'react'

import { proseComponent } from '../content/load'
import { mdxComponents } from './mdx'
import { ProseLocaleContext } from './prose-locale'

/** The MDX of a page. The lazy component comes from a cache with one entry per file, so it keeps its identity. */
export function Prose({ locale, slug }: { locale: DocsLocale; slug: string }) {
  const component = proseComponent(locale, slug)
  if (!component) return null
  return (
    <ProseLocaleContext value={locale}>{createElement(component, { components: mdxComponents })}</ProseLocaleContext>
  )
}
