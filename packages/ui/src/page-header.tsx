import type { ReactNode } from 'react'

interface Props {
  /** What the page is: its title and the line under it */
  children: ReactNode
  /** Controls the host owns: the sections of the app, the language */
  aside?: ReactNode
  /** Buttons that work on the whole page */
  actions?: ReactNode
}

const BAR = 'border-b border-line-soft bg-bg/90 backdrop-blur-md'

/**
 * The header of a page. It stays at the top while the page scrolls, so the sections of the app and the page's own
 * actions are always at hand. On a narrow screen only the bar with the sections stays, or the title would take a
 * fifth of the screen along. Put it first in a page container padded `px-3 pt-3.5 md:px-5 md:pt-5`: its negative
 * margins take it to the edges of that padding.
 */
export function PageHeader({ children, aside, actions }: Props) {
  return (
    <>
      {/* Its own element, before the header: a bar inside the header would leave the screen with it. In a grid
          container the gap already separates it from the title. */}
      {aside && (
        <div
          className={`sticky top-0 z-20 -mx-3 -mt-3.5 mb-3 px-3 py-2.5 md:hidden print:hidden [.grid>&]:mb-0 ${BAR}`}
        >
          {aside}
        </div>
      )}
      <header className="flex flex-col gap-3 md:sticky md:top-0 md:z-20 md:-mx-5 md:-mt-5 md:flex-row md:items-end md:gap-2 md:border-b md:border-line-soft md:bg-bg/90 md:px-5 md:py-3.5 md:backdrop-blur-md print:hidden">
        <div className="min-w-0 md:mr-auto">{children}</div>
        {aside && <div className="max-md:hidden">{aside}</div>}
        {actions && <div className="flex gap-2 *:flex-1 md:*:flex-none">{actions}</div>}
      </header>
    </>
  )
}
