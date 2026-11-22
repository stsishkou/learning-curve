import { fmtDay, fmtHours, parseLocal } from '#/lib/plan/dates'
import { countsToBudget, durationHours, type Occurrence } from '#/lib/plan/occurrences'
import type { Plan } from '#/lib/plan/types'

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
    <aside className="panel aside">
      <h4>Учёба на этой неделе</h4>
      <div className="budget">
        <div className="big">
          {fmtHours(total)}
          <small>из {budget} ч</small>
        </div>
        <div className={`meter${total > budget ? ' over' : ''}`} role="img" aria-label={`${total} из ${budget} часов`}>
          {rows.map((c) => (
            <i key={c.id} style={{ background: c.color, width: `${(perCalendar[c.id] / Math.max(budget, total)) * 100}%` }} />
          ))}
        </div>
      </div>
      <ul className="legend">
        {rows.length ? (
          rows.map((c) => (
            <li key={c.id}>
              <span style={{ '--c': c.color } as React.CSSProperties}>
                <i />
                {c.name}
              </span>
              <em>{fmtHours(perCalendar[c.id])}</em>
            </li>
          ))
        ) : (
          <li>
            <span>Нет учебных событий</span>
          </li>
        )}
      </ul>
      <div className="note">
        Буфер по субботам и спортзал в бюджет не входят. Часовой пояс {plan.meta.timezone}, план обновлён{' '}
        {fmtDay(parseLocal(plan.meta.generated))}.
      </div>
    </aside>
  )
}
