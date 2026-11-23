// Every page of the site in every language. The build pre-renders this list and writes it to the sitemap; each page
// names its translations in <head> from the same list, so the two cannot disagree.
export interface Alternate {
  locale: string
  path: string
}

export interface SitePath {
  path: string
  alternates: readonly Alternate[]
}

/** The pages that exist once per language, as paths below `/<locale>/`. Trailing slashes match the built files. */
export const SECTIONS = ['', 'decisions/', 'glossary/', 'integration/'] as const

export const chapterSection = (chapterId: string) => `chapters/${chapterId}/`

export const localizedPath = (locale: string, section: string) => `/${locale}/${section}`

export const alternatesOf = (locales: readonly string[], section: string): readonly Alternate[] =>
  locales.map((locale) => ({ locale, path: localizedPath(locale, section) }))

export function sitePaths(locales: readonly string[], chapterIds: readonly string[]): readonly SitePath[] {
  const sections = [...SECTIONS, ...chapterIds.map(chapterSection)]
  return [
    { path: '/', alternates: alternatesOf(locales, '') },
    ...sections.flatMap((section) =>
      locales.map((locale) => ({ path: localizedPath(locale, section), alternates: alternatesOf(locales, section) })),
    ),
  ]
}
