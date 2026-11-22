import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { parseLocal, type Plan } from '@lc/plan-domain'
import type { ReactNode } from 'react'

import { PlanTitle } from '../../../features/rename-plan'

interface Props {
  plan: Plan
  /** Present when the plan can be renamed */
  onRename?: (title: string) => void
  /** Controls the host owns, such as the sections of the app and the language */
  aside?: ReactNode
  /** Buttons that work on the whole plan: its file, its export */
  children?: ReactNode
}

/** What plan this is and how big, with the host's controls and the plan-wide actions next to it. */
export function PlannerHeader({ plan, onRename, aside, children }: Props) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:gap-2">
      <div className="min-w-0 md:mr-auto">
        <p className="text-[11.5px] font-semibold tracking-[0.08em] text-muted uppercase">{m.plan_label()}</p>
        <PlanTitle title={plan.meta.title} onRename={onRename} />
        <p className="mt-1 text-[14px] text-muted">
          {m.plan_summary({
            events: m.events_count({ count: plan.events.length }),
            calendars: m.in_calendars({ count: plan.calendars.length }),
            date: fmtDay(parseLocal(plan.meta.planEnd)),
          })}
        </p>
      </div>
      {/* On a narrow screen the sections of the app come first, as a bar above the title. */}
      <div className="order-first md:order-none">{aside}</div>
      <div className="flex gap-2 *:flex-1 md:*:flex-none">{children}</div>
    </header>
  )
}
