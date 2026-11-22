import { m } from '@lc/i18n/messages'
import { Check, X } from '@lc/ui'

interface Props {
  /** How many sessions should be over and are not marked done */
  count: number
  onMarkDone: () => void
  onCatchUp: () => void
  onDismiss: () => void
}

/** Says the plan and the reality have drifted apart, and offers the two ways to bring them together. */
export function OverdueBar({ count, onMarkDone, onCatchUp, onDismiss }: Props) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-[13.5px]"
      role="status"
    >
      <span className="min-w-0 flex-1 basis-full md:basis-0">{m.overdue({ count })}</span>
      <button
        type="button"
        className="flex items-center gap-1 font-semibold text-done-ink hover:underline"
        onClick={onMarkDone}
      >
        <Check size={15} aria-hidden /> {m.overdue_mark()}
      </button>
      <button type="button" className="font-semibold text-focus hover:underline" onClick={onCatchUp}>
        {m.catchup()}
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
