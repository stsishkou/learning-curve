// The way back from a component to the chapters that built it. The stand and the guide are published side by side
// (the stand under the guide's stand/), so by default the guide is the folder above; main.ts sets it otherwise.
import {
  type Chapter,
  chaptersForFeature,
  DOCS_DEFAULT_LOCALE,
  docsPageUrl,
  type FeatureId,
  featureOfPath,
  isDocsLocale,
  sourceUrl,
} from '@lc/docs-contract'

// Storybook replaces `process.env.STORYBOOK_*` in what it builds; where nothing does, as in the stand's browser
// tests, `process` does not exist.
function configured(): unknown {
  try {
    return process.env.STORYBOOK_DOCS_URL
  } catch {
    return undefined
  }
}
const url = configured()
export const DOCS_URL = typeof url === 'string' && url ? url : '../'

export interface StoryOrigin {
  feature: FeatureId | null
  chapters: Chapter[]
  /** The story file in the repository, without the `./` and `../` Storybook puts in front */
  file: string
}

export function originOf(importPath: string): StoryOrigin {
  const feature = featureOfPath(importPath)
  return {
    feature,
    chapters: feature ? chaptersForFeature(feature) : [],
    file: importPath.replace(/^(\.{1,2}\/)+/, ''),
  }
}

const localeOf = (value: unknown) => (typeof value === 'string' && isDocsLocale(value) ? value : DOCS_DEFAULT_LOCALE)

/** A chapter of the guide in the stand's current language. */
export const chapterHref = (chapter: Chapter, locale: unknown): string =>
  docsPageUrl(DOCS_URL, localeOf(locale), { chapterId: chapter.id })

export const guideHref = (locale: unknown): string => docsPageUrl(DOCS_URL, localeOf(locale))

export const fileHref = (file: string): string => sourceUrl(file, undefined, 'main')
