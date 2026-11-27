import { m } from '@lc/i18n/messages'
import {
  AppBar,
  CircleHelp,
  Popover,
  ScreenButtons,
  Settings,
  Type,
  useFullscreen,
  useHelpMode,
  useIconsOnly,
} from '@lc/ui'
import { getRouteApi, Link, useMatches, useNavigate, useSearch } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { DocsButton } from './DocsButton'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeSwitcher } from './ThemeSwitcher'

const root = getRouteApi('__root__')

// The router marks the link of the page on screen with aria-current.
const TAB =
  'rounded-[10px] px-3 py-2 text-[13.5px] font-medium whitespace-nowrap text-muted transition-colors duration-150 hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(10_16_30/0.12)]'
const ROW =
  'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left whitespace-nowrap hover:bg-surface-2 focus-visible:bg-surface-2'

/** The component stand is a separate app: linked while developing, or wherever `VITE_STAND_URL` says it is hosted. */
const hosted: unknown = import.meta.env.VITE_STAND_URL
export const STAND_URL: string | undefined =
  typeof hosted === 'string' ? hosted : import.meta.env.DEV ? 'http://localhost:6006' : undefined

/** What Expand takes away on each page, for its tooltip. A route that is not here has no Expand. */
const EXPAND_HINT: Record<string, () => string> = {
  '/': () => m.expand_hint(),
  '/timeline': () => m.timeline_expand_hint(),
  '/focus': () => m.focus_expand_hint(),
  '/dashboard': () => m.dash_expand_hint(),
}

/** A switch kept in this browser, as a row of the settings: it leaves them open, as a switch leaves a menu open. */
function Switch({
  icon,
  label,
  hint,
  on,
  flip,
}: {
  icon: ReactNode
  label: string
  hint?: string
  on: boolean
  flip: () => void
}) {
  return (
    <button type="button" className={ROW} aria-pressed={on} data-tip={hint} onClick={flip}>
      <span aria-hidden className={`grid w-4 place-items-center ${on ? 'text-focus' : 'text-muted'}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <span aria-hidden className="w-4 text-focus">
        {on ? '✓' : ''}
      </span>
    </button>
  )
}

function Choice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-1">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  )
}

/**
 * The bar across the top of every page, the same on each: the sections of the app, Expand and Full screen for the
 * page on screen, and the settings of this browser with the links about the app. A page laid out wide (expanded or
 * in full screen) takes the whole window: the bar steps aside, and the page shows Collapse in its own top row.
 */
export function ShellBar() {
  const docs = root.useLoaderData({ select: (data) => data.docs })
  const routeId = useMatches({ select: (matches) => matches.at(-1)?.routeId ?? '' })
  const expanded = useSearch({ strict: false, select: (search) => search.expanded === true })
  const navigate = useNavigate()
  const fullscreen = useFullscreen()
  const [iconsOnly, toggleIconsOnly] = useIconsOnly()
  const [help, toggleHelp] = useHelpMode()
  if (expanded || fullscreen.on) return null
  const expandHint = EXPAND_HINT[routeId]
  return (
    <AppBar
      label={m.nav()}
      nav={
        <>
          <Link to="/" className={TAB} activeOptions={{ exact: true, includeSearch: false }}>
            {m.nav_plan()}
          </Link>
          <Link to="/timeline" className={TAB}>
            {m.timeline()}
          </Link>
          <Link to="/focus" className={TAB}>
            {m.focus()}
          </Link>
          <Link to="/dashboard" className={TAB}>
            {m.dashboard()}
          </Link>
        </>
      }
    >
      {expandHint && (
        <ScreenButtons
          expanded={false}
          onToggleExpanded={() =>
            void navigate({ to: '.', search: (prev) => ({ ...prev, expanded: true }), resetScroll: false })
          }
          fullscreen={fullscreen.supported ? fullscreen : undefined}
          labels={{
            expand: m.expand(),
            collapse: m.collapse(),
            expandHint: expandHint(),
            fullscreen: m.fullscreen(),
            fullscreenExit: m.fullscreen_exit(),
            fullscreenHint: m.fullscreen_hint(),
          }}
          // On a phone the two keep only their icons, to leave the row to the sections.
          className="py-1.5 text-[13.5px] max-md:px-2.5 max-md:[&>.lc-label]:sr-only"
        />
      )}
      <Popover label={m.app_menu()} icon={<Settings size={17} aria-hidden />}>
        <div className="grid gap-2.5 text-[13.5px]">
          <Choice label={m.language()}>
            <LanguageSwitcher />
          </Choice>
          <Choice label={m.theme()}>
            <ThemeSwitcher />
          </Choice>
          <div className="grid gap-0.5 border-t border-line-soft pt-2">
            <Switch
              icon={<Type size={16} />}
              label={m.icons_only()}
              hint={m.icons_only_hint()}
              on={iconsOnly}
              flip={toggleIconsOnly}
            />
            <Switch icon={<CircleHelp size={16} />} label={m.help_toggle()} on={help} flip={toggleHelp} />
          </div>
          {(STAND_URL ?? docs.remote) && (
            <div className="grid gap-0.5 border-t border-line-soft pt-2">
              {STAND_URL && (
                <a className={ROW} href={STAND_URL} target="_blank" rel="noreferrer">
                  {m.nav_components()} ↗
                </a>
              )}
              {docs.remote && <DocsButton config={{ ...docs, remote: docs.remote }} className={ROW} />}
            </div>
          )}
        </div>
      </Popover>
    </AppBar>
  )
}
