import { fmtDay, fmtHours, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, parseLocal, planStats, type Plan, type WeekStats } from '@lc/plan-domain'
import { useMemo, type ReactNode } from 'react'

import { useNow } from '../../../shared/lib'
import { BurnUp } from '../../../widgets/burn-up'
import { CourseBars } from '../../../widgets/course-bars'
import { PaceForecast } from '../../../widgets/pace-forecast'
import { StatTiles } from '../../../widgets/stat-tiles'
import { WeeklyLoad } from '../../../widgets/weekly-load'

interface Props {
  plan: Plan
  /** Shown next to the title: controls the host owns, such as navigation and the language switcher */
  headerAside?: ReactNode
  /** Minsk wall-clock time to show the plan at, instead of the running clock */
  now?: number
}

/** Each week with its hours and the running totals up to it. */
function tableRows(weeks: WeekStats[]) {
  let planned = 0
  let done = 0
  return weeks.map((week) => {
    planned += week.planned
    done += week.done
    return { week, totals: [week.planned, week.done, planned, done] }
  })
}

/** Progress of the plan in numbers and charts. Read-only: marks are made in the planner. */
export function DashboardPage({ plan, headerAside, now: fixed }: Props) {
  const clock = useNow()
  const now = fixed ?? clock
  const stats = useMemo(() => planStats(plan, now ?? 0), [plan, now])
  const rows = useMemo(() => tableRows(stats.weeks), [stats])
  return (
    <div className="mx-auto grid max-w-[1240px] gap-4 px-3 pt-3.5 pb-10 md:px-5 md:pt-5 md:pb-12">
      <header className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px]/[1.2] font-semibold tracking-[-0.01em]">{m.dashboard()}</h1>
          <p className="mt-1 text-[14px] text-muted">
            {plan.meta.title} · {m.dash_until({ date: fmtDay(parseLocal(plan.meta.planEnd)) })}
          </p>
        </div>
        <div className="order-first md:order-none">{headerAside}</div>
      </header>

      <StatTiles plan={plan} stats={stats} now={now} />
      <BurnUp stats={stats} now={now} />
      <PaceForecast plan={plan} now={now} />
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <WeeklyLoad plan={plan} stats={stats} now={now} />
        <CourseBars plan={plan} />
      </div>

      <details className="rounded-2xl border border-line bg-surface px-4 py-3 md:px-5">
        <summary className="cursor-pointer text-[14px] font-semibold">{m.dash_table()}</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[13px] tabular-nums">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  {m.dash_week()}
                </th>
                {[m.dash_planned(), m.dash_done(), m.dash_total_planned(), m.dash_total_done()].map((label) => (
                  <th key={label} scope="col" className="py-1.5 pl-3 text-right font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ week, totals }) => (
                <tr key={week.monday} className="border-b border-line-soft last:border-b-0">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    {fmtShort(week.monday)} – {fmtShort(week.monday + 6 * DAY)}
                  </th>
                  {totals.map((hours, i) => (
                    // oxlint-disable-next-line react/no-array-index-key -- four fixed columns
                    <td key={i} className="py-1.5 pl-3 text-right">
                      {fmtHours(hours)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
