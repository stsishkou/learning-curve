import { m } from '@lc/i18n/messages'
import { Link } from '@tanstack/react-router'

import { LanguageSwitcher } from './LanguageSwitcher'

// The router marks the link of the page on screen with aria-current.
const TAB =
  'rounded-[10px] px-3 py-2 text-[13.5px] font-medium whitespace-nowrap text-muted transition-colors duration-150 hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(10_16_30/0.12)]'

/** The component stand is a separate app: linked while developing, or wherever `VITE_STAND_URL` says it is hosted. */
const hosted: unknown = import.meta.env.VITE_STAND_URL
export const STAND_URL: string | undefined =
  typeof hosted === 'string' ? hosted : import.meta.env.DEV ? 'http://localhost:6006' : undefined

/** What the shell puts in every page header: the sections of the app and the language. */
export function ShellAside() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
      <nav className="flex gap-1.5" aria-label={m.nav()}>
        <Link to="/" className={TAB} activeOptions={{ exact: true, includeSearch: false }}>
          {m.nav_plan()}
        </Link>
        <Link to="/focus" className={TAB}>
          {m.focus()}
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
