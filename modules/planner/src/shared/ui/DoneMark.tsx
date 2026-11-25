import { m } from '@lc/i18n/messages'

interface Props {
  /** A done session whose time was not logged: the tick is drawn hollow */
  unlogged: boolean
  /** The event was marked done a moment ago: the tick pops in */
  fresh?: boolean | undefined
  className?: string | undefined
}

/**
 * The tick of a done event. A session done without a logged time gets a small tick in a dashed ring, so the gap
 * reads by shape and not by colour alone, and a screen reader hears that its time is not logged.
 */
export function DoneMark({ unlogged, fresh, className = '' }: Props) {
  const pop = fresh ? 'lc-done-pop' : ''
  if (!unlogged) return <span className={`text-done-ink no-underline ${pop} ${className}`}>✓</span>
  return (
    <span
      className={`inline-grid size-[1.2em] place-items-center rounded-full border border-dashed border-current align-[-0.2em] text-done-ink no-underline ${pop} ${className}`}
    >
      <span className="text-[0.7em] leading-none">✓</span>
      <span className="sr-only">{m.spent_not_logged()}</span>
    </span>
  )
}
