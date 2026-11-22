import { fmtDay, fmtHours } from '#/lib/format'
import { parseLocal } from '#/lib/plan/dates'
import { countsToBudget, durationHours, type Occurrence } from '#/lib/plan/occurrences'
import type { Plan } from '#/lib/plan/types'
import { m } from '#/paraglide/messages.js'

import { Dot, calendarColor } from './ui'

interface Props {
  plan: Plan
  weekItems: Occurrence[]
}

/** Study hours in the visible week against the weekly budget. */
export function BudgetPanel({ plan, weekItems }: Props) {
  const perCalendar: Record<string, number> = {}
  let total = 0
  for (const o of weekItems) {
    if (!countsToBudget(o)) continue
    perCalendar[o.calendar] = (perCalendar[o.calendar] ?? 0) + durationHours(o)
    total += durationHours(o)
  }
  const budget = plan.meta.weeklyBudgetHours
  const rows = plan.calendars.filter((c) => perCalendar[c.id])

  return (
    <aside className="rounded-2xl border border-line bg-surface p-4">
      <h4 className="mb-2.5 text-[14px]/[1.3] font-semibold">{m.study_this_week()}</h4>
      <div className="tabular-nums">
        <div className="font-display text-[30px] leading-none font-bold tracking-[-0.02em]">
          {fmtHours(total)}
          <small className="ml-1 font-sans text-[14px] leading-normal font-medium text-muted">
            {m.budget_of({ budget: fmtHours(budget) })}
          </small>
        </div>
        <div
          className={`mt-2.5 mb-1 flex h-2 overflow-hidden rounded bg-line-soft ${total > budget ? 'outline-2 outline-offset-1 outline-today' : ''}`}
          role="img"
          aria-label={m.budget_progress({ total, budget })}
        >
          {rows.map((c) => (
            <i
              key={c.id}
              className="block h-full"
              style={{ background: c.color, width: `${(perCalendar[c.id] / Math.max(budget, total)) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <ul className="mt-3.5 grid gap-1.5 text-[13px]">
        {rows.length ? (
          rows.map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span className="flex min-w-0 items-center gap-[7px]" style={calendarColor(c.color)}>
                <Dot className="size-[9px]" />
                {c.name}
              </span>
              <em className="text-muted not-italic tabular-nums">{fmtHours(perCalendar[c.id])}</em>
            </li>
          ))
        ) : (
          <li>{m.no_study_events()}</li>
        )}
      </ul>
      <div className="mt-4 border-t border-line-soft pt-3.5 text-[12.5px] text-muted">
        {m.budget_note({ timezone: plan.meta.timezone, date: fmtDay(parseLocal(plan.meta.generated)) })}
      </div>
    </aside>
  )
}
