import { fmtDay, fmtHours, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, paceForecast, parseLocal, planStats, type Plan, type WeekStats } from '@lc/plan-domain'
import { HelpToggle, IconsToggle, PageHeader, ScreenButtons, stickyTop, useFullscreen, useShortcuts } from '@lc/ui'
import { useMemo, type ReactNode } from 'react'

import { useNow } from '../../../shared/lib'
import { BiasTrend } from '../../../widgets/bias-trend'
import { BurnUp } from '../../../widgets/burn-up'
import { CourseBars } from '../../../widgets/course-bars'
import { ModuleOverruns } from '../../../widgets/module-overruns'
import { PaceForecast } from '../../../widgets/pace-forecast'
import { RatioStrip } from '../../../widgets/ratio-strip'
import { StatTiles } from '../../../widgets/stat-tiles'
import { StudyStreak } from '../../../widgets/study-streak'
import { WeeklyLoad } from '../../../widgets/weekly-load'

interface Props {
  plan: Plan
  /** Shown next to the title: controls the host owns, such as navigation and the language switcher */
  headerAside?: ReactNode
  /** Minsk wall-clock time to show the plan at, instead of the running clock */
  now?: number
  /** The charts take the whole window: no page header */
  expanded?: boolean | undefined
  /** Present when the host keeps `expanded`: the page then offers Expand */
  onExpandedChange?: ((expanded: boolean) => void) | undefined
  /** Present when the host can open the done sessions without a time, to fill them in */
  onFillTimes?: (() => void) | undefined
}

// The negative margins take the bar to the edges of the page padding, as the page header does.
const PINNED =
  'sticky top-0 z-20 -mx-3 -mt-3 border-b border-line-soft bg-bg/90 px-3 py-2.5 backdrop-blur-md md:-mx-5 md:px-5'

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
export function DashboardPage({
  plan,
  headerAside,
  now: fixed,
  expanded = false,
  onExpandedChange,
  onFillTimes,
}: Props) {
  const clock = useNow()
  const now = fixed ?? clock
  const stats = useMemo(() => planStats(plan, now ?? 0), [plan, now])
  const rows = useMemo(() => tableRows(stats.weeks), [stats])
  const fullscreen = useFullscreen()
  // The whole screen is for the charts: it is laid out as Expand lays it out.
  const wide = expanded || fullscreen.on
  const toggleExpanded = onExpandedChange && (() => onExpandedChange(!expanded))

  useShortcuts({
    ...(toggleExpanded && { e: toggleExpanded }),
    ...(fullscreen.supported && { 'shift+f': fullscreen.toggle }),
  })

  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)] gap-4 px-3 md:px-5 ${wide ? 'pt-3 pb-4' : 'mx-auto max-w-[1240px] pt-3.5 pb-10 md:pt-5 md:pb-12'}`}
    >
      {!wide && (
        <PageHeader
          aside={headerAside}
          actions={
            <>
              <IconsToggle label={m.icons_only()} hint={m.icons_only_hint()} className="max-md:flex-none!" />
              <HelpToggle label={m.help_toggle()} className="max-md:flex-none!" />
            </>
          }
        >
          <h1 className="text-[22px]/[1.2] font-semibold tracking-[-0.01em]">{m.dashboard()}</h1>
        </PageHeader>
      )}
      {/* Out of the header, so the plan stays named while the header is hidden; it then takes the header's place at
          the top. */}
      <div
        ref={wide ? stickyTop : undefined}
        className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${wide ? PINNED : ''}`}
      >
        <p className="min-w-0 flex-1 basis-[240px] text-[14px] text-muted">
          {plan.meta.title} · {m.dash_until({ date: fmtDay(parseLocal(plan.meta.planEnd)) })}
        </p>
        {toggleExpanded && (
          <div className="flex gap-2">
            <ScreenButtons
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              fullscreen={fullscreen.supported ? fullscreen : undefined}
              labels={{
                expand: m.expand(),
                collapse: m.collapse(),
                expandHint: m.dash_expand_hint(),
                fullscreen: m.fullscreen(),
                fullscreenExit: m.fullscreen_exit(),
                fullscreenHint: m.fullscreen_hint(),
              }}
              className="py-1! text-[13px]"
            />
          </div>
        )}
      </div>

      <StatTiles plan={plan} stats={stats} now={now} />
      <StudyStreak plan={plan} now={now} />
      <BurnUp stats={stats} now={now} forecast={now === null ? null : paceForecast(plan, now).finish} />
      <PaceForecast plan={plan} now={now} onFillTimes={onFillTimes} />
      <RatioStrip plan={plan} />
      <BiasTrend plan={plan} />
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <WeeklyLoad plan={plan} stats={stats} now={now} />
        <CourseBars plan={plan} />
      </div>

      <ModuleOverruns plan={plan} />

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
