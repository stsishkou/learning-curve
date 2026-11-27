import { fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { parseLocal, type Plan } from '@lc/plan-domain'
import type { UpdatePreview } from '@lc/plan-domain/protocol'
import { Button, FOOT, Modal, TITLE } from '@lc/ui'

import { PlanDiffList, RuleWarningList } from '../../../shared/ui'

interface Props {
  open: boolean
  /** The plan as it is */
  plan: Plan
  preview: UpdatePreview | null
  /** Apply is open: everything is worked out and fits */
  ready: boolean
  saving: boolean
  onApply: () => void
  onClose: () => void
}

const LABELS = {
  added: (count: number) => m.ai_added({ count }),
  removed: (count: number) => m.ai_removed({ count }),
  changed: (count: number) => m.file_changed({ count }),
}

/** Every session the draft adds, removes or moves, old slot to new, with the rules it breaks and the weeks it overfills. */
export function DraftReview({ open, plan, preview, ready, saving, onApply, onClose }: Props) {
  return (
    <Modal open={open && preview !== null} size="wide" onClose={onClose}>
      {preview && (
        <>
          <h2 className={TITLE}>{m.timeline_review_title()}</h2>
          <div className="mt-3 grid gap-3">
            {preview.problem && (
              <p className="text-[13px] text-today-ink" role="alert">
                {m.timeline_problem({ reason: preview.problem.message })}
              </p>
            )}
            {preview.overBudget.length > 0 && (
              <p className="text-[13px] text-today-ink">
                {m.ai_over_budget({
                  budget: fmtHours(plan.meta.weeklyBudgetHours),
                  weeks: preview.overBudget
                    .map((w) => `${fmtDay(parseLocal(`${w.week}T00:00`))} (${fmtHours(w.hours)})`)
                    .join(', '),
                })}
              </p>
            )}
            <RuleWarningList warnings={preview.warnings} />
            <PlanDiffList diff={preview.diff} after={preview.after} before={plan} labels={LABELS} />
          </div>
          <div className={FOOT}>
            <Button onClick={onClose}>{m.close()}</Button>
            <Button primary disabled={!ready || saving} onClick={onApply}>
              {m.reschedule_apply()}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
