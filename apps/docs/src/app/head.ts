import { DOCS_LOCALES, type DocsLocale } from '@lc/docs-contract'

import { alternatesOf } from '../site-paths'

/** An absolute URL of a site path such as `/en/glossary/`, for links that leave the page: hreflang, canonical. */
export const absolute = (path: string) =>
  `${import.meta.env.VITE_DOCS_ORIGIN}${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

/**
 * The <head> links of a page that exists in every language: itself as canonical, its translations, and the
 * language chooser at the root as `x-default`.
 */
export function localizedLinks(locale: DocsLocale, section: string) {
  return [
    { rel: 'canonical', href: absolute(`/${locale}/${section}`) },
    ...alternatesOf(DOCS_LOCALES, section).map((alternate) => ({
      rel: 'alternate',
      hrefLang: alternate.locale,
      href: absolute(alternate.path),
    })),
    { rel: 'alternate', hrefLang: 'x-default', href: absolute('/') },
  ]
}
