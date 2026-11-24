import { fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { countsToBudget, durationHours, type Occurrence, parseLocal, type Plan } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'
import type { ReactNode } from 'react'

interface Props {
  /** Gives the weekly budget and the calendars' names and colors */
  plan: Plan
  /** The occurrences of the week on screen; the ones outside the budget (gym, the buffer) are skipped */
  weekItems: Occurrence[]
  /** Shown between the numbers and the closing note */
  children?: ReactNode
}

/** Study hours in the visible week against the weekly budget. */
export function BudgetPanel({ plan, weekItems, children }: Props) {
  const perCalendar: Record<string, number> = {}
  let total = 0
  for (const o of weekItems) {
    if (!countsToBudget(o)) continue
    perCalendar[o.calendar] = (perCalendar[o.calendar] ?? 0) + durationHours(o)
    total += durationHours(o)
  }
  const budget = plan.meta.weeklyBudgetHours
  const rows = plan.calendars.flatMap((calendar) => {
    const hours = perCalendar[calendar.id]
    return hours ? [{ calendar, hours }] : []
  })

  return (
    <div>
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
          {rows.map(({ calendar: c, hours }) => (
            <i
              key={c.id}
              className="block h-full"
              style={{ background: c.color, width: `${(hours / Math.max(budget, total)) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <ul className="mt-3.5 grid gap-1.5 text-[13px]">
        {rows.length ? (
          rows.map(({ calendar: c, hours }) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span className="flex min-w-0 items-center gap-[7px]" style={calendarColor(c.color)}>
                <Dot className="size-[9px]" />
                {c.name}
              </span>
              <em className="text-muted not-italic tabular-nums">{fmtHours(hours)}</em>
            </li>
          ))
        ) : (
          <li>{m.no_study_events()}</li>
        )}
      </ul>
      {children && <div className="mt-4 border-t border-line-soft pt-3.5">{children}</div>}
      <div className="mt-4 border-t border-line-soft pt-3.5 text-[12.5px] text-muted">
        {m.budget_note({ timezone: plan.meta.timezone, date: fmtDay(parseLocal(plan.meta.generated)) })}
      </div>
    </div>
  )
}
