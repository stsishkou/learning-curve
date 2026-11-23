import type { DocsLocale } from '@lc/docs-contract'
import { createContext, use } from 'react'

/**
 * What a component needs to know about where it is rendered. The same components run as the docs site and inside a
 * host's drawer, so none of them reads the URL, `document` or an ambient locale: they read this.
 */
export interface DocsEnv {
  locale: DocsLocale
  /** The docs site's root, ending with `/`: the base path on the site, an absolute URL inside a host */
  site: string
  /** The component stand's root, ending with `/` */
  stand: string
  mode: 'site' | 'embedded'
}

export const DocsEnvContext = createContext<DocsEnv>({ locale: 'en', site: '/', stand: '/stand/', mode: 'site' })

export const useDocsEnv = (): DocsEnv => use(DocsEnvContext)
export const useLocale = (): DocsLocale => use(DocsEnvContext).locale
