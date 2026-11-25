import { fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY } from '@lc/plan-domain'
import { X } from '@lc/ui'

interface Props {
  /** Monday of the week that ended, Minsk wall-clock ms */
  monday: number
  onReview: () => void
  onDismiss: () => void
}

/** Asks for the look back at the week that just ended, while it is still fresh. */
export function LastWeekBar({ monday, onReview, onDismiss }: Props) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-[13.5px]"
      role="status"
    >
      <span className="min-w-0 flex-1 basis-full md:basis-0">
        {m.last_week_unreviewed({ dates: `${fmtShort(monday)} – ${fmtShort(monday + 6 * DAY)}` })}
      </span>
      <button type="button" className="font-semibold text-focus hover:underline" onClick={onReview}>
        {m.last_week_review()}
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
