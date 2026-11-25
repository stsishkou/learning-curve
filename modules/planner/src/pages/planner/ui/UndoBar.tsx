import { m } from '@lc/i18n/messages'
import type { RuleWarning } from '@lc/plan-domain'
import { TriangleAlert, X } from '@lc/ui'

import { warningLabel } from '../../../shared/ui'

interface Props {
  /** What was just changed */
  label: string
  /** Rules of the plan the change broke: said, not stopped */
  warnings?: RuleWarning[] | undefined
  onUndo: () => void
  onHistory: () => void
  onDismiss: () => void
}

/** Offers to take back the change that was just made. */
export function UndoBar({ label, warnings, onUndo, onHistory, onDismiss }: Props) {
  const [first] = warnings ?? []
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
      {first && (
        <p className="flex basis-full items-start gap-2 text-[13px]/[1.4] text-today-ink">
          <TriangleAlert size={15} aria-hidden className="mt-px flex-none" />
          <span className="min-w-0">
            {warningLabel(first)}
            {warnings && warnings.length > 1 && ` · ${m.and_more({ count: warnings.length - 1 })}`}
          </span>
        </p>
      )}
    </div>
  )
}
