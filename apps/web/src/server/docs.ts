import { createServerFn } from '@tanstack/react-start'

export interface DocsConfig {
  /** The guide's federation manifest; null hides the docs button */
  remote: string | null
  /** The static guide, linked when the remote cannot be loaded */
  site: string | null
}

/**
 * Where the guide is deployed, read from the environment when the server runs: one build of the planner can point
 * at any deployment of the guide, or at none. While developing it defaults to `pnpm --filter @lc/docs preview`.
 */
export const getDocsConfig = createServerFn({ method: 'GET' }).handler((): DocsConfig => {
  const remote =
    process.env.DOCS_REMOTE_URL ?? (import.meta.env.DEV ? 'http://localhost:4310/remote/v1/mf-manifest.json' : '')
  if (!remote) return { remote: null, site: null }
  return { remote, site: process.env.DOCS_SITE_URL ?? new URL('../../', remote).href }
})
