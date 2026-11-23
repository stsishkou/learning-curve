import { CHAPTERS, DOCS_LOCALES, REPOSITORY_URL } from '@lc/docs-contract'
import { ExternalLink, PageHeader, Segmented } from '@lc/ui'
import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { m } from '../paraglide/messages'
import { useDocsEnv } from './env'
import { Search } from './Search'
import { setTheme, storedTheme, type Theme } from './theme'

const SHIPPING = CHAPTERS.find((chapter) => chapter.id === 'shipping')?.id ?? 'shipping'

/** The same page in another language: the path with its first segment swapped. */
function LanguageLinks() {
  const { locale } = useDocsEnv()
  const pathname = useLocation({ select: (location) => location.pathname })
  return (
    <nav
      aria-label={m.language({}, { locale })}
      className="inline-flex gap-0.5 rounded-[10px] border border-line bg-surface-2 p-[3px]"
    >
      {DOCS_LOCALES.map((target) => (
        <a
          key={target}
          lang={target}
          hrefLang={target}
          href={pathname.replace(`/${locale}/`, `/${target}/`)}
          aria-current={target === locale ? 'page' : undefined}
          className="rounded-[7px] px-2.5 py-1 font-medium text-muted hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:shadow-[0_0_0_1px_var(--line)]"
        >
          {target.toUpperCase()}
        </a>
      ))}
    </nav>
  )
}

function ThemeSwitch() {
  const { locale } = useDocsEnv()
  const [theme, setThemeState] = useState<Theme>('system')
  useEffect(() => setThemeState(storedTheme()), [])
  return (
    <Segmented<Theme>
      label={m.theme({}, { locale })}
      value={theme}
      options={[
        { value: 'system', label: m.theme_system({}, { locale }) },
        { value: 'light', label: m.theme_light({}, { locale }) },
        { value: 'dark', label: m.theme_dark({}, { locale }) },
      ]}
      onChange={(next) => {
        setTheme(next)
        setThemeState(next)
      }}
    />
  )
}

const NAV_LINK =
  'rounded-lg px-2.5 py-1.5 font-medium text-muted hover:bg-surface-2 hover:text-ink [&.active]:text-ink [&.active]:bg-surface-2'

export function SiteHeader() {
  const { locale, stand } = useDocsEnv()
  return (
    <PageHeader
      aside={
        <nav aria-label={m.nav_label({}, { locale })} className="flex flex-wrap items-center gap-1 text-sm">
          <Link to="/$locale/" params={{ locale }} className={NAV_LINK} activeOptions={{ exact: true }}>
            {m.nav_chapters({}, { locale })}
          </Link>
          <Link to="/$locale/decisions/" params={{ locale }} className={NAV_LINK}>
            {m.nav_decisions({}, { locale })}
          </Link>
          <Link to="/$locale/glossary/" params={{ locale }} className={NAV_LINK}>
            {m.nav_glossary({}, { locale })}
          </Link>
          <Link to="/$locale/integration/" params={{ locale }} className={NAV_LINK}>
            {m.nav_integration({}, { locale })}
          </Link>
          <Link to="/$locale/chapters/$chapterId/" params={{ locale, chapterId: SHIPPING }} className={NAV_LINK}>
            {m.nav_deploy({}, { locale })}
          </Link>
          <a href={stand} className={`${NAV_LINK} inline-flex items-center gap-1`}>
            {m.nav_stand({}, { locale })}
            <ExternalLink aria-hidden size={12} />
          </a>
          <a href={REPOSITORY_URL} className={`${NAV_LINK} inline-flex items-center gap-1`}>
            {m.nav_source({}, { locale })}
            <ExternalLink aria-hidden size={12} />
          </a>
        </nav>
      }
      actions={
        <>
          <Search />
          <ThemeSwitch />
          <LanguageLinks />
        </>
      }
    >
      <Link to="/$locale/" params={{ locale }} className="flex flex-col">
        <span className="font-display text-xl leading-tight">{m.site_name({}, { locale })}</span>
        <span className="text-sm text-muted">{m.site_tagline({}, { locale })}</span>
      </Link>
    </PageHeader>
  )
}
