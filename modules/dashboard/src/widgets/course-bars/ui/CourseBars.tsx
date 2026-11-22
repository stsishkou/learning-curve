import { fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { courseProgress, parseLocal, type Plan } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'

import { Card } from '../../../shared/ui'

/** One row per course: how many of its hours are done and when its last session is. */
export function CourseBars({ plan }: { plan: Plan }) {
  const courses = courseProgress(plan)
  return (
    <Card title={m.dash_courses()}>
      <ul className="grid gap-3.5">
        {courses.map((c) => {
          const share = c.hours ? c.doneHours / c.hours : 0
          return (
            <li key={c.calendar.id} style={calendarColor(c.calendar.color)}>
              <div className="flex items-baseline gap-2 text-[13.5px]">
                <Dot className="size-2.5 flex-none -translate-y-px" />
                <span className="min-w-0 flex-1 truncate font-medium">{c.calendar.name}</span>
                <span className="flex-none text-[12.5px] text-muted tabular-nums">
                  {fmtHours(c.doneHours)} / {fmtHours(c.hours)} · {Math.round(share * 100)}%
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-label={c.calendar.name}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(share * 100)}
              >
                <div className="h-full rounded-full bg-cal" style={{ width: `${share * 100}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[12px] text-muted tabular-nums">
                <span>{m.dash_sessions_done({ done: c.doneSessions, total: c.sessions })}</span>
                <span>{m.dash_finish({ date: fmtDay(parseLocal(`${c.finish}T00:00`)) })}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
