import { m } from '@lc/i18n/messages'
import { X } from '@lc/ui'

interface Props {
  /** What was just changed */
  label: string
  onUndo: () => void
  onHistory: () => void
  onDismiss: () => void
}

/** Offers to take back the change that was just made. */
export function UndoBar({ label, onUndo, onHistory, onDismiss }: Props) {
  return (
    // Floats over the page: a bar in the flow would push the calendar down right after every drag.
    <div
      className="fixed inset-x-3 bottom-4 z-20 mx-auto flex max-w-[560px] flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13.5px] shadow-[0_12px_32px_rgb(10_16_30/0.28)]"
      role="status"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <button type="button" className="font-semibold text-focus hover:underline" onClick={onUndo}>
        {m.undo()}
      </button>
      <button type="button" className="text-muted hover:text-ink" onClick={onHistory}>
        {m.history()}
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
