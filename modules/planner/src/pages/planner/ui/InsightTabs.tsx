import { m } from '@lc/i18n/messages'
import type { Occurrence, Plan, PlanEvent } from '@lc/plan-domain'
import { Hint, Segmented } from '@lc/ui'
import { useRef, useState } from 'react'

import { useFillHeight } from '../../../shared/lib'
import { BudgetPanel } from '../../../widgets/budget-panel'
import { CourseProgress } from '../../../widgets/course-progress'
import { GoalLadder } from '../../../widgets/goal-ladder'
import { MiniMonth } from '../../../widgets/mini-month'
import { PlanMap } from '../../../widgets/plan-map'

type Tab = 'week' | 'courses' | 'map' | 'dates'

const HELP: Record<Tab, { title: () => string; text: () => string }> = {
  week: { title: m.help_budget_title, text: m.help_budget },
  courses: { title: m.help_courses_title, text: m.help_courses },
  map: { title: m.help_map_title, text: m.help_map },
  dates: { title: m.help_dates_title, text: m.help_dates },
}

interface Props {
  plan: Plan
  weekItems: Occurrence[]
  hidden: ReadonlySet<string>
  now: number | null
  weekStart: number
  /** The days the calendar shows now */
  shown: { start: number; days: number }
  onSelect: (e: PlanEvent) => void
  onPickWeek: (monday: number) => void
  onPickDay: (day: number) => void
  onReview: () => void
}

/**
 * One card, four looks at the plan: this week's budget, progress per course, the map of all weeks, and a month
 * to jump to a date with.
 */
export function InsightTabs({
  plan,
  weekItems,
  hidden,
  now,
  weekStart,
  shown,
  onSelect,
  onPickWeek,
  onPickDay,
  onReview,
}: Props) {
  const [tab, setTab] = useState<Tab>('week')
  const body = useRef<HTMLDivElement>(null)
  // 961 is the `lg` breakpoint; the gap is the page's bottom padding plus the card's own.
  const maxHeight = useFillHeight(body, true, { minWidth: 961, minHeight: 80, bottomGap: 66 })
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3.5 grid justify-items-end gap-2 text-[13px] *:first:w-full">
        <Segmented
          label={m.insights()}
          fill
          value={tab}
          options={[
            { value: 'week', label: m.tab_week() },
            { value: 'courses', label: m.tab_courses() },
            { value: 'map', label: m.tab_map() },
            { value: 'dates', label: m.tab_dates() },
          ]}
          onChange={setTab}
        />
        <Hint title={HELP[tab].title()} text={HELP[tab].text()} />
      </div>
      {/* Capped on a wide screen so a long course list scrolls inside the card instead of stretching the page. */}
      <div ref={body} className="lg:overflow-y-auto lg:pr-3" style={{ maxHeight }}>
        {tab === 'week' && (
          <BudgetPanel plan={plan} weekItems={weekItems}>
            <GoalLadder plan={plan} weekStart={weekStart} onReview={onReview} />
          </BudgetPanel>
        )}
        {tab === 'courses' && <CourseProgress plan={plan} onSelect={onSelect} />}
        {tab === 'map' && (
          <PlanMap plan={plan} hidden={hidden} now={now} weekStart={weekStart} onPickWeek={onPickWeek} />
        )}
        {tab === 'dates' && (
          <MiniMonth
            // Back to the month on screen whenever the calendar moves.
            key={shown.start}
            plan={plan}
            hidden={hidden}
            now={now}
            shown={shown}
            onPickDay={onPickDay}
            onPickWeek={onPickWeek}
          />
        )}
      </div>
    </section>
  )
}
