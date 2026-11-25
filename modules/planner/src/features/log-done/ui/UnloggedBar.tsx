import { m } from '@lc/i18n/messages'
import { Timer, X } from '@lc/ui'

interface Props {
  /** How many done sessions have no logged time */
  count: number
  onFill: () => void
  onDismiss: () => void
}

/** Says that some done sessions have no time, which the pace cannot count, and opens the list to fill them in. */
export function UnloggedBar({ count, onFill, onDismiss }: Props) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-[13.5px]"
      role="status"
    >
      <Timer size={15} aria-hidden className="flex-none text-muted" />
      <span className="min-w-0 flex-1">{m.unlogged_bar({ count })}</span>
      <button type="button" className="font-semibold text-focus hover:underline" onClick={onFill}>
        {m.unlogged_fill()}
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
