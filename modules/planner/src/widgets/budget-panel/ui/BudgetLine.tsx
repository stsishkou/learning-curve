import { fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { countsToBudget, durationHours, type Occurrence, type Plan } from '@lc/plan-domain'

interface Props {
  /** Gives the weekly budget */
  plan: Plan
  /** The occurrences of the week on screen; the ones outside the budget (gym, the buffer) are skipped */
  weekItems: Occurrence[]
}

const share = (part: number, whole: number) => `${whole ? (part / whole) * 100 : 0}%`

/**
 * The study hours of the week on screen in one line: done, planned and the budget. For the expanded calendar, which
 * has no side panel; the toolbar names the week.
 */
export function BudgetLine({ plan, weekItems }: Props) {
  let total = 0
  let done = 0
  for (const o of weekItems) {
    if (!countsToBudget(o)) continue
    total += durationHours(o)
    if (o.done) done += durationHours(o)
  }
  const budget = plan.meta.weeklyBudgetHours
  const scale = Math.max(budget, total)
  const words = m.week_summary({ done: fmtHours(done), total: fmtHours(total), budget: fmtHours(budget) })
  // The pinned bar has little room: the numbers show, the sentence is the tooltip and what a screen reader says.
  return (
    <p className="flex items-center gap-2 text-[13px] whitespace-nowrap text-muted tabular-nums" title={words}>
      <span className="relative h-1.5 w-16 flex-none overflow-hidden rounded bg-line-soft" aria-hidden>
        <i className="absolute inset-y-0 left-0 bg-muted/40" style={{ width: share(total, scale) }} />
        <i className="absolute inset-y-0 left-0 bg-done" style={{ width: share(done, scale) }} />
      </span>
      <span className={total > budget ? 'text-today-ink' : ''} aria-hidden>
        {fmtHours(done)} / {fmtHours(total)}
      </span>
      <span className="sr-only">{words}</span>
    </p>
  )
}
