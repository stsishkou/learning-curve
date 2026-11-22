import { m } from '@lc/i18n/messages'
import { Link } from '@tanstack/react-router'

import { LanguageSwitcher } from './LanguageSwitcher'

// The router marks the link of the page on screen with aria-current.
const TAB =
  'rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] font-medium whitespace-nowrap hover:bg-surface-2 aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-bg'

/** The component stand is a separate app: linked while developing, or wherever `VITE_STAND_URL` says it is hosted. */
export const STAND_URL: string | undefined =
  import.meta.env.VITE_STAND_URL ?? (import.meta.env.DEV ? 'http://localhost:6006' : undefined)

/** What the shell puts in every page header: the sections of the app and the language. */
export function ShellAside() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
      <nav className="flex gap-1.5" aria-label={m.nav()}>
        <Link to="/" className={TAB} activeOptions={{ exact: true, includeSearch: false }}>
          {m.nav_plan()}
        </Link>
        <Link to="/dashboard" className={TAB}>
          {m.dashboard()}
        </Link>
        {STAND_URL && (
          <a className={TAB} href={STAND_URL} target="_blank" rel="noreferrer">
            {m.nav_components()} ↗
          </a>
        )}
      </nav>
      <LanguageSwitcher />
    </div>
  )
}
