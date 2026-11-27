import type { ReactNode } from 'react'

import { stickyTop } from './sticky-top'

interface Props {
  /** Accessible name of the navigation, e.g. "Sections" */
  label: string
  /** The links to the sections of the app, the current one marked `aria-current="page"` */
  nav: ReactNode
  /** The buttons every page has, at the end of the bar */
  children?: ReactNode
}

/**
 * The bar across the top of every page: the sections of the app, then the buttons that work on any page. It stays
 * while the page scrolls, and its height and place do not depend on what it holds, so moving between the sections
 * does not move it. Its row is as wide as the pages and padded as they are (`mx-auto max-w-[1240px] px-3 md:px-5`):
 * the first tab starts where a page's content starts.
 */
export function AppBar({ label, nav, children }: Props) {
  return (
    <header
      ref={stickyTop}
      className="sticky top-0 z-20 border-b border-line-soft bg-bg/90 backdrop-blur-md print:hidden"
    >
      <div className="mx-auto flex h-13 max-w-[1240px] items-center gap-2 px-3 md:px-5">
        {/* Scrolls sideways on a phone rather than push the page wider than the screen. */}
        <nav
          aria-label={label}
          className="-my-1 flex min-w-0 flex-1 [scrollbar-width:none] gap-1.5 overflow-x-auto py-1"
        >
          {nav}
        </nav>
        {children && <div className="flex flex-none items-center gap-2">{children}</div>}
      </div>
    </header>
  )
}
