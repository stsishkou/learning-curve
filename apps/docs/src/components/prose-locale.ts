import type { DocsLocale } from '@lc/docs-contract'
import { createContext } from 'react'

/**
 * The language a page's prose is written in, which differs from the reader's when it falls back to English. Text a
 * component puts inside the prose follows it, so a sentence does not switch language halfway.
 */
export const ProseLocaleContext = createContext<DocsLocale | null>(null)
