import { m } from '@lc/i18n/messages'
import { Button, X } from '@lc/ui'

// Floats over the page, so it stays at hand wherever the chart is scrolled to.
const BAR =
  'fixed inset-x-3 bottom-3 z-20 mx-auto flex max-w-[760px] flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] shadow-[0_12px_32px_rgb(10_16_30/0.28)] md:bottom-4 md:px-3.5 md:py-2.5 md:text-[13.5px]'
// On a phone the three buttons share one row.
const ACTION = 'py-1.5! max-md:px-2!'

interface Props {
  /** Courses in the draft */
  courses: number
  /** Sessions it gives another time */
  sessions: number
  /** Rules of the plan it breaks */
  warnings: number
  /** Why it cannot be applied as it is: a change that does not fit, or a failed save */
  problem: string | null
  /** A re-balance is being worked out */
  working: boolean
  /** Everything is worked out and fits: Apply is open */
  ready: boolean
  saving: boolean
  onReview: () => void
  onDiscard: () => void
  onApply: () => void
}

/** What the draft would change, and the three things to do with it: look closer, drop it, or store it. */
export function DraftBar(props: Props) {
  const { courses, sessions, warnings, problem, working, ready, saving, onReview, onDiscard, onApply } = props
  return (
    <section aria-label={m.timeline_draft()} className={BAR}>
      <p className="min-w-0 flex-1 basis-[220px] leading-[1.4]">
        <span className="font-semibold">{m.timeline_draft()}</span>
        <span className="text-muted tabular-nums"> · {m.timeline_draft_summary({ courses, sessions })}</span>
        {warnings > 0 && <span className="text-today-ink"> · {m.timeline_warnings({ count: warnings })}</span>}
        {working && (
          <span className="block text-[12.5px] text-muted" role="status">
            {m.reschedule_working()}
          </span>
        )}
        {problem !== null && (
          <span className="block text-[12.5px] text-today-ink" role="alert">
            {problem}
          </span>
        )}
      </p>
      <div className="flex w-full gap-2 *:flex-1 md:w-auto md:*:flex-none">
        <Button className={ACTION} onClick={onReview}>
          {m.timeline_review()}
        </Button>
        <Button className={ACTION} onClick={onDiscard}>
          {m.timeline_discard()}
        </Button>
        <Button primary className={ACTION} disabled={!ready || saving} onClick={onApply}>
          {m.reschedule_apply()}
        </Button>
      </div>
    </section>
  )
}

interface AppliedProps {
  /** Changes stored by the last Apply */
  count: number
  onUndo: () => void
  onDismiss: () => void
}

/** Says the draft was stored and offers to take all of it back. */
export function AppliedBar({ count, onUndo, onDismiss }: AppliedProps) {
  return (
    <div className={BAR} role="status">
      <span className="min-w-0 flex-1 truncate">{m.timeline_applied({ count })}</span>
      <button type="button" className="font-semibold text-focus hover:underline" onClick={onUndo}>
        {m.undo()}
      </button>
      <button
        type="button"
        className="grid place-items-center text-muted hover:text-ink"
        aria-label={m.close()}
        onClick={onDismiss}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  )
}
