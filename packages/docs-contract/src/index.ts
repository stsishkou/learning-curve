// The API a host gets from the docs remote. Types and pure helpers only: no React, no DOM, nothing that would put
// docs code into a host's bundle. Breaking changes bump the major version and go to CHANGELOG.md.
// With its extension: the docs Vite configs import this package, and Vite loads configs with Node, which does not
// guess one.
import { type ChapterId, chaptersForFeature, type FeatureId } from './catalog.ts'

export * from './catalog.ts'

/** Semver of this contract. The remote reports the version it implements; a host accepts one major. */
export const DOCS_CONTRACT = '1.0.0'

/** The federation names: the remote's container and the module that holds the help drawer. */
export const DOCS_REMOTE_NAME = 'lc_docs'
export const DOCS_HELP_MODULE = `${DOCS_REMOTE_NAME}/help`

export const DOCS_LOCALES = ['ru', 'en', 'es'] as const
export type DocsLocale = (typeof DOCS_LOCALES)[number]
/** The language the routes start from, as in the root app. Chapters are written in English first. */
export const DOCS_DEFAULT_LOCALE: DocsLocale = 'ru'
export const DOCS_SOURCE_LOCALE: DocsLocale = 'en'

export const isDocsLocale = (value: string): value is DocsLocale => DOCS_LOCALES.some((locale) => locale === value)

/**
 * `inherit` follows the host: its CSS custom properties and `color-scheme` reach the docs through the shadow
 * boundary. `light` and `dark` pin the scheme for a host that does not use the same tokens.
 */
export type DocsTheme = 'inherit' | 'light' | 'dark'

/** Design tokens a host may override, as CSS values. Defaults are the root app's own tokens. */
export type DocsToken = 'bg' | 'surface' | 'surface-2' | 'ink' | 'muted' | 'line' | 'focus'

export interface DocsContext {
  locale: DocsLocale
  theme: DocsTheme
  tokens?: Partial<Record<DocsToken, string>> | undefined
  /** The slice the person is looking at, for "how was this built" */
  featureId?: FeatureId | undefined
  /** Where the full site lives, for "open in a new tab" and as the fallback the host links to */
  siteUrl?: string | undefined
}

export type DocsTarget =
  | { chapterId: ChapterId; anchor?: string | undefined }
  | { topicId: FeatureId; anchor?: string | undefined }

export type DocsFeature = 'help'

export interface DocsEvents {
  'docs:ready': { version: string }
  'docs:open': DocsTarget
  'docs:navigate': DocsTarget
  'docs:close': { reason: 'user' | 'host' }
  'docs:language-changed': { locale: DocsLocale }
  'docs:error': { feature: DocsFeature; message: string }
}

export type DocsEventName = keyof DocsEvents

export interface DocsHost {
  /** The contract version the remote implements */
  readonly version: string
  open(target: DocsTarget): void
  close(): void
  /** Applies a new locale, theme or feature while the drawer is open or closed */
  update(context: Partial<DocsContext>): void
  on<K extends DocsEventName>(type: K, handler: (detail: DocsEvents[K]) => void): () => void
  /** Removes the drawer and everything the remote added to the page */
  destroy(): void
}

export interface DocsHostOptions {
  context: DocsContext
  /** Where the drawer's shadow host is appended; `document.body` by default */
  mount?: HTMLElement | undefined
}

/** What `lc_docs/help` exports. */
export interface DocsHelpModule {
  version: string
  createDocsHost(options: DocsHostOptions): DocsHost
}

const major = (version: string) => version.split('.').at(0) ?? ''

/** True when a remote of `remote` version can serve a host built against `host`: the same major. */
export function isCompatible(remote: string, host: string = DOCS_CONTRACT): boolean {
  return major(remote) !== '' && major(remote) === major(host)
}

/** A shape check for what `loadRemote` returned, so a host never calls into an unexpected module. */
export function isDocsHelpModule(value: unknown): value is DocsHelpModule {
  if (typeof value !== 'object' || value === null) return false
  return (
    'version' in value &&
    typeof value.version === 'string' &&
    'createDocsHost' in value &&
    typeof value.createDocsHost === 'function'
  )
}

/**
 * The page of the static site that shows `target`: a chapter, or the first chapter about a feature. A host links
 * there when the remote cannot be loaded.
 */
export function docsPageUrl(siteUrl: string, locale: DocsLocale, target?: DocsTarget): string {
  const root = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`
  const chapterId = !target
    ? undefined
    : 'chapterId' in target
      ? target.chapterId
      : chaptersForFeature(target.topicId).at(0)?.id
  return chapterId ? `${root}${locale}/chapters/${chapterId}/` : `${root}${locale}/`
}
