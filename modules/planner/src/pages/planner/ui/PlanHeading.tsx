import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { parseLocal, type Plan } from '@lc/plan-domain'
import type { ReactNode } from 'react'

import { PlanTitle } from '../../../features/rename-plan'

interface Props {
  plan: Plan
  /** Present when the plan can be renamed */
  onRename?: ((title: string) => void) | undefined
  /** After the plan's size: its help mark and the plan-wide actions the host adds */
  children?: ReactNode
}

/** What plan this is and how big, in one row: the page's heading, first on the page under the app's bar. */
export function PlanHeading({ plan, onRename, children }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 print:hidden">
      <PlanTitle title={plan.meta.title} onRename={onRename} />
      <p className="text-[14px] text-muted">
        {m.plan_summary({
          events: m.events_count({ count: plan.events.length }),
          calendars: m.in_calendars({ count: plan.calendars.length }),
          date: fmtDay(parseLocal(plan.meta.planEnd)),
        })}
      </p>
      {children}
    </div>
  )
}
