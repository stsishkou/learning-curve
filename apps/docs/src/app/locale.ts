import { DOCS_DEFAULT_LOCALE, type DocsLocale, isDocsLocale } from '@lc/docs-contract'
import { notFound } from '@tanstack/react-router'

/** Ends the route with the not-found page. The router's own signal, which is not an Error: it is caught, not reported. */
export function missing(): never {
  // oxlint-disable-next-line typescript/only-throw-error -- the router recognises the object notFound() returns
  throw notFound()
}

/** The `$locale` segment as a locale; any other value is a page that does not exist. */
export function localeParam(value: string): DocsLocale {
  return isDocsLocale(value) ? value : missing()
}

/** For rendering, after `beforeLoad` has rejected unknown values. */
export const asLocale = (value: string): DocsLocale => (isDocsLocale(value) ? value : DOCS_DEFAULT_LOCALE)
