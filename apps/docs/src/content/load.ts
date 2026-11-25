// Where chapter content comes from. Syllabi are TypeScript data, one module per batch of chapters, split from the
// page bundle and loaded by route loaders; prose is MDX per language, rendered lazily. Translations are files with
// the same names under another language folder; a chapter without one falls back to English, and the page says so.
import { type ChapterId, DOCS_SOURCE_LOCALE, type DocsLocale } from '@lc/docs-contract'
import type { MDXContent } from 'mdx/types'
import { type LazyExoticComponent, lazy } from 'react'

import type { Syllabus } from './syllabus/types'

const SYLLABI = import.meta.glob<Record<string, unknown>>('./syllabus/part-*.ts')

const isSyllabus = (value: unknown): value is Syllabus =>
  typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'steps' in value

let all: Promise<readonly Syllabus[]> | undefined

/** Every syllabus written so far, in no particular order. */
export function loadSyllabi(): Promise<readonly Syllabus[]> {
  all ??= (async () => {
    const modules = await Promise.all(Object.values(SYLLABI).map((load) => load()))
    return modules.flatMap((module) =>
      Object.values(module).flatMap((value) => (Array.isArray(value) ? value.filter(isSyllabus) : [])),
    )
  })()
  return all
}

export async function loadSyllabus(id: ChapterId): Promise<Syllabus | null> {
  const syllabi = await loadSyllabi()
  return syllabi.find((syllabus) => syllabus.id === id) ?? null
}

const PROSE = import.meta.glob<{ default: MDXContent }>('./*/*.mdx')
const lazyProse = new Map<string, LazyExoticComponent<MDXContent>>()

const proseKey = (locale: DocsLocale, slug: string) => `./${locale}/${slug}.mdx`

/** The language the prose for `slug` exists in for a reader of `locale`: theirs, else English, else none. */
export function proseLocale(locale: DocsLocale, slug: string): DocsLocale | null {
  if (proseKey(locale, slug) in PROSE) return locale
  if (proseKey(DOCS_SOURCE_LOCALE, slug) in PROSE) return DOCS_SOURCE_LOCALE
  return null
}

/** The prose of a page as a lazy component, the same instance on every render. */
export function proseComponent(locale: DocsLocale, slug: string): LazyExoticComponent<MDXContent> | null {
  const key = proseKey(locale, slug)
  const load = PROSE[key]
  if (!load) return null
  let component = lazyProse.get(key)
  if (!component) {
    component = lazy(load)
    lazyProse.set(key, component)
  }
  return component
}

/** Loads the prose module ahead of render, so a server render or a client navigation does not suspend on it. */
export async function preloadProse(locale: DocsLocale, slug: string): Promise<void> {
  await PROSE[proseKey(locale, slug)]?.()
}
