import { m } from '@lc/i18n/messages'
import { CalendarSync } from '@lc/ui'

interface Props {
  /** How many edits made in calendar apps wait for the person */
  count: number
  onReview: () => void
}

/** Says that edits made in a calendar app wait to be taken into the plan or kept out. */
export function CalendarReviewBar({ count, onReview }: Props) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-[13.5px]"
      role="status"
    >
      <CalendarSync size={15} aria-hidden className="flex-none text-muted" />
      <span className="min-w-0 flex-1">{m.sync_review_bar({ count })}</span>
      <button type="button" className="font-semibold text-focus hover:underline" onClick={onReview}>
        {m.sync_review()}
      </button>
    </div>
  )
}
