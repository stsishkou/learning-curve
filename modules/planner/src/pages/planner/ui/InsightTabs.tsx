import { m } from '@lc/i18n/messages'
import type { Occurrence, Plan, PlanEvent } from '@lc/plan-domain'
import { Segmented } from '@lc/ui'
import { useRef, useState } from 'react'

import { useFillHeight } from '../../../shared/lib'
import { BudgetPanel } from '../../../widgets/budget-panel'
import { CourseProgress } from '../../../widgets/course-progress'
import { GoalLadder } from '../../../widgets/goal-ladder'
import { PlanMap } from '../../../widgets/plan-map'

type Tab = 'week' | 'courses' | 'map'

interface Props {
  plan: Plan
  weekItems: Occurrence[]
  hidden: ReadonlySet<string>
  now: number | null
  weekStart: number
  onSelect: (e: PlanEvent) => void
  onPickWeek: (monday: number) => void
  onReview: () => void
}

/** One card, three looks at the plan: this week's budget, progress per course, the map of all weeks. */
export function InsightTabs({ plan, weekItems, hidden, now, weekStart, onSelect, onPickWeek, onReview }: Props) {
  const [tab, setTab] = useState<Tab>('week')
  const body = useRef<HTMLDivElement>(null)
  // 961 is the `lg` breakpoint; the gap is the page's bottom padding plus the card's own.
  const maxHeight = useFillHeight(body, true, { minWidth: 961, minHeight: 80, bottomGap: 66 })
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3.5 text-[13px]">
        <Segmented
          label={m.insights()}
          value={tab}
          options={[
            { value: 'week', label: m.tab_week() },
            { value: 'courses', label: m.tab_courses() },
            { value: 'map', label: m.tab_map() },
          ]}
          onChange={setTab}
        />
      </div>
      {/* Capped on a wide screen so a long course list scrolls inside the card instead of stretching the page. */}
      <div ref={body} className="lg:overflow-y-auto" style={{ maxHeight }}>
        {tab === 'week' && (
          <BudgetPanel plan={plan} weekItems={weekItems}>
            <GoalLadder plan={plan} weekStart={weekStart} onReview={onReview} />
          </BudgetPanel>
        )}
        {tab === 'courses' && <CourseProgress plan={plan} onSelect={onSelect} />}
        {tab === 'map' && (
          <PlanMap plan={plan} hidden={hidden} now={now} weekStart={weekStart} onPickWeek={onPickWeek} />
        )}
      </div>
    </section>
  )
}
