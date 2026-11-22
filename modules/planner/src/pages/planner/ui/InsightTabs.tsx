import { m } from '@lc/i18n/messages'
import type { Occurrence, Plan, PlanEvent } from '@lc/plan-domain'
import { Segmented } from '@lc/ui'
import { useState } from 'react'

import { BudgetPanel } from '../../../widgets/budget-panel'
import { CourseProgress } from '../../../widgets/course-progress'
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
}

/** One card, three looks at the plan: this week's budget, progress per course, the map of all weeks. */
export function InsightTabs({ plan, weekItems, hidden, now, weekStart, onSelect, onPickWeek }: Props) {
  const [tab, setTab] = useState<Tab>('week')
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
      <div className="lg:max-h-[max(260px,calc(100dvh-560px))] lg:overflow-y-auto">
        {tab === 'week' && <BudgetPanel plan={plan} weekItems={weekItems} />}
        {tab === 'courses' && <CourseProgress plan={plan} onSelect={onSelect} />}
        {tab === 'map' && (
          <PlanMap plan={plan} hidden={hidden} now={now} weekStart={weekStart} onPickWeek={onPickWeek} />
        )}
      </div>
    </section>
  )
}
