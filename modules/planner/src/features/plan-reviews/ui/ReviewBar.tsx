import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, parseLocal } from '@lc/plan-domain'
import type { ReviewOffer } from '@lc/plan-domain/insights'
import { Repeat, X } from '@lc/ui'

interface Props {
  /** The finished module and the review sessions worked out for it */
  offer: ReviewOffer
  /** How many more finished modules wait behind this one */
  more: number
  /** Adds the reviews to the plan */
  onPlan: () => void
  /** Declines them: the module is not offered again */
  onDismiss: () => void
}

/**
 * Offers to go back to a module that was just finished: three short sessions with growing gaps, each on the day
 * and at the hour shown. Nothing is added until `Plan the reviews` is pressed, and that is one step to undo.
 */
export function ReviewBar({ offer, more, onPlan, onDismiss }: Props) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-[13.5px]"
      role="status"
    >
      <Repeat size={15} aria-hidden className="flex-none text-done-ink" />
      <span className="min-w-0 flex-1 basis-full md:basis-0">
        {m.reviews_offer({ title: offer.title })}{' '}
        <span className="text-muted tabular-nums">
          {offer.reviews.map((r) => `${fmtDay(parseLocal(r.start))} ${hm(parseLocal(r.start))}`).join(' · ')}
          {more > 0 && ` · ${m.reviews_more({ count: more })}`}
        </span>
      </span>
      <button type="button" className="font-semibold text-focus hover:underline" onClick={onPlan}>
        {m.reviews_plan()}
      </button>
      <button
        type="button"
        className="grid place-items-center text-muted hover:text-ink"
        aria-label={m.reviews_decline()}
        data-tip={m.reviews_decline()}
        onClick={onDismiss}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  )
}
