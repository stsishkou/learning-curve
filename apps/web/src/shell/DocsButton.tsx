import { DOCS_DEFAULT_LOCALE, type DocsTarget, docsPageUrl, type FeatureId, isDocsLocale } from '@lc/docs-contract'
import { useDocsHost } from '@lc/docs-host'
import { m } from '@lc/i18n/messages'
import { getLocale } from '@lc/i18n/runtime'
import { useMatches } from '@tanstack/react-router'

import type { DocsConfig } from '#/server/docs'

/** The slice each page shows, so the guide opens on the chapters that built it. */
const FEATURE_OF_ROUTE: Record<string, FeatureId> = {
  '/': 'planner/pages/planner',
  '/timeline': 'planner/pages/timeline',
  '/focus': 'planner/pages/focus',
  '/dashboard': 'dashboard/pages/dashboard',
}

interface Props {
  config: DocsConfig & { remote: string }
  className: string
}

/**
 * Opens the guide in a drawer. The guide is a separate deployment loaded with Module Federation on the first
 * click, so nothing of it is in the planner's own bundle; when it cannot be loaded the button becomes a link to the
 * guide's site.
 */
export function DocsButton({ config, className }: Props) {
  const routeId = useMatches({ select: (matches) => matches.at(-1)?.routeId ?? '/' })
  const featureId = FEATURE_OF_ROUTE[routeId]
  const current = getLocale()
  const locale = isDocsLocale(current) ? current : DOCS_DEFAULT_LOCALE
  const site = config.site ?? undefined
  const docs = useDocsHost({
    manifestUrl: config.remote,
    context: { locale, theme: 'inherit', featureId, siteUrl: site },
  })
  const target: DocsTarget | undefined = featureId ? { topicId: featureId } : undefined

  if (docs.status === 'failed' && site) {
    return (
      <a
        className={className}
        href={docsPageUrl(site, locale, target)}
        target="_blank"
        rel="noreferrer"
        title={m.docs_unavailable()}
      >
        {m.nav_docs()} ↗
      </a>
    )
  }
  return (
    <button
      type="button"
      className={className}
      aria-busy={docs.status === 'loading'}
      onClick={() => void docs.open(target ?? { chapterId: 'scaffold' })}
    >
      {m.nav_docs()}
    </button>
  )
}
