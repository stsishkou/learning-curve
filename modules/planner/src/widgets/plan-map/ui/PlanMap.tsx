import { fmtHours, fmtMonthShort, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  countsToBudget,
  DAY,
  durationHours,
  mondayOf,
  occurrences,
  parseLocal,
  planStart,
  startOfDay,
  ymd,
  type Plan,
} from '@lc/plan-domain'
import { useMemo } from 'react'

interface Props {
  plan: Plan
  /** Ids of the calendars filtered out */
  hidden: ReadonlySet<string>
  /** Minsk wall-clock ms; null before the clock is known, as on the server */
  now: number | null
  /** Monday of the week on screen */
  weekStart: number
  /** Called with the Monday of the week that was clicked */
  onPickWeek: (monday: number) => void
}

interface DayCell {
  hours: number
  /** Color of the calendar with most hours that day */
  color: string | null
  /** Every session of the day is marked done */
  done: boolean
}

const BAR_HEIGHT = 28

/**
 * The whole plan as a strip of weeks: a bar of study hours over each week (red above the budget) and a cell per
 * day in the color of its main course. A click goes to that week.
 */
export function PlanMap({ plan, hidden, now, weekStart, onPickWeek }: Props) {
  const today = now === null ? null : startOfDay(now)
  const budget = plan.meta.weeklyBudgetHours
  const weeks = useMemo(() => {
    const first = mondayOf(planStart(plan))
    const last = mondayOf(parseLocal(plan.meta.planEnd))
    const colors = new Map(plan.calendars.map((c) => [c.id, c.color]))
    const days = new Map<number, { byCalendar: Map<string, number>; sessions: number; done: number }>()
    for (const o of occurrences(plan, first, last + 7 * DAY, hidden)) {
      if (!countsToBudget(o)) continue
      const day = days.get(startOfDay(o.s)) ?? { byCalendar: new Map<string, number>(), sessions: 0, done: 0 }
      day.byCalendar.set(o.calendar, (day.byCalendar.get(o.calendar) ?? 0) + durationHours(o))
      day.sessions += 1
      if (o.done) day.done += 1
      days.set(startOfDay(o.s), day)
    }
    return Array.from({ length: Math.max(1, (last - first) / (7 * DAY) + 1) }, (_week, w) => {
      const monday = first + w * 7 * DAY
      const cells = Array.from({ length: 7 }, (_day, d): DayCell => {
        const day = days.get(monday + d * DAY)
        if (!day) return { hours: 0, color: null, done: false }
        const [main] = [...day.byCalendar].toSorted((a, b) => b[1] - a[1])
        const hours = [...day.byCalendar.values()].reduce((sum, h) => sum + h, 0)
        return { hours, color: colors.get(main[0]) ?? null, done: day.done === day.sessions }
      })
      return { monday, cells, hours: cells.reduce((sum, c) => sum + c.hours, 0) }
    })
  }, [plan, hidden])
  const peak = Math.max(budget, ...weeks.map((w) => w.hours))

  return (
    <div>
      <div className="flex gap-[3px]" role="group" aria-label={m.plan_map()}>
        {weeks.map((week, i) => {
          const monthChanges =
            i === 0 || new Date(week.monday).getUTCMonth() !== new Date(weeks[i - 1].monday).getUTCMonth()
          return (
            <button
              key={week.monday}
              type="button"
              className={`group flex min-w-0 flex-1 flex-col gap-[3px] rounded-md p-[2px] hover:bg-surface-2 ${
                week.monday === weekStart ? 'bg-surface-2 outline-2 outline-ink' : ''
              }`}
              aria-current={week.monday === weekStart ? 'true' : undefined}
              aria-label={m.plan_map_week({ date: fmtShort(week.monday), hours: fmtHours(week.hours) })}
              title={m.plan_map_week({ date: fmtShort(week.monday), hours: fmtHours(week.hours) })}
              onClick={() => onPickWeek(week.monday)}
            >
              <span className="flex items-end" style={{ height: BAR_HEIGHT }}>
                <i
                  className={`block w-full rounded-sm ${week.hours > budget ? 'bg-today' : 'bg-muted/50 group-hover:bg-muted'}`}
                  style={{ height: Math.max(week.hours ? 2 : 0, (week.hours / peak) * BAR_HEIGHT) }}
                />
              </span>
              {week.cells.map((cell, d) => {
                const day = week.monday + d * DAY
                return (
                  <i
                    // oxlint-disable-next-line react/no-array-index-key -- seven fixed weekdays
                    key={d}
                    className={`relative block aspect-square w-full rounded-[3px] ${cell.color ? '' : 'bg-line-soft'} ${
                      day === today ? 'outline-2 outline-offset-1 outline-today' : ''
                    } ${plan.meta.holidays.includes(ymd(day)) && !cell.color ? 'opacity-40' : ''}`}
                    style={
                      cell.color
                        ? { background: cell.color, opacity: cell.done ? 0.35 : Math.min(1, 0.45 + cell.hours * 0.2) }
                        : undefined
                    }
                  />
                )
              })}
              {/* The month is drawn from an attribute: as text inside the button it would have to repeat in its label. */}
              <span
                aria-hidden
                className="h-3 text-left text-[9.5px]/[1] text-muted before:content-[attr(data-month)]"
                data-month={monthChanges ? fmtMonthShort(week.monday) : ''}
              />
            </button>
          )
        })}
      </div>
      <p className="mt-3 border-t border-line-soft pt-3.5 text-[12.5px] text-muted">
        {m.plan_map_hint({ budget: fmtHours(budget) })}
      </p>
    </div>
  )
}
