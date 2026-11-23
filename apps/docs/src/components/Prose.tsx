import type { DocsLocale } from '@lc/docs-contract'
import { createElement } from 'react'

import { proseComponent } from '../content/load'
import { mdxComponents } from './mdx'

/** The MDX of a page. The lazy component comes from a cache with one entry per file, so it keeps its identity. */
export function Prose({ locale, slug }: { locale: DocsLocale; slug: string }) {
  const component = proseComponent(locale, slug)
  return component ? createElement(component, { components: mdxComponents }) : null
}
