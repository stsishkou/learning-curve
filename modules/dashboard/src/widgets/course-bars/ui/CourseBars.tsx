import { fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { countsTwice, courseProgress, groupByLabel, parseLocal, type CourseProgress, type Plan } from '@lc/plan-domain'
import { calendarColor, Dot, Tag } from '@lc/ui'

import { Card } from '../../../shared/ui'

interface Props {
  plan: Plan
  /** Lists the courses under their labels, each label with its total */
  byLabel?: boolean | undefined
}

/** One row per course: how many of its hours are done and when its last session is; by label, a total per label. */
export function CourseBars({ plan, byLabel = false }: Props) {
  const courses = courseProgress(plan)
  const groups = groupByLabel(courses, (c) => c.calendar)
  const grouped = byLabel && groups.some((group) => group.label !== null)
  return (
    <Card title={m.dash_courses()} hint={grouped && countsTwice(groups) ? m.dash_counts_twice() : undefined}>
      {grouped ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
          {groups.map((group) => {
            const hours = group.items.reduce((sum, c) => sum + c.hours, 0)
            const done = group.items.reduce((sum, c) => sum + c.doneHours, 0)
            const name = group.label ?? m.label_none()
            return (
              <section key={group.label ?? ''} aria-label={name}>
                <div className="flex items-baseline gap-2 text-[13.5px]">
                  <Tag size={13} aria-hidden className="flex-none translate-y-0.5 text-muted" />
                  <h4 className="min-w-0 flex-1 truncate font-semibold">{name}</h4>
                  <span className="flex-none text-[12.5px] text-muted tabular-nums">
                    {fmtHours(done)} / {fmtHours(hours)} · {Math.round((hours ? done / hours : 0) * 100)}%
                  </span>
                </div>
                <ul className="mt-2.5 grid grid-cols-[minmax(0,1fr)] gap-3 border-l-2 border-line-soft pl-3">
                  {group.items.map((c) => (
                    <CourseRow key={c.calendar.id} course={c} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
          {courses.map((c) => (
            <CourseRow key={c.calendar.id} course={c} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function CourseRow({ course: c }: { course: CourseProgress }) {
  const share = c.hours ? c.doneHours / c.hours : 0
  return (
    <li style={calendarColor(c.calendar.color)}>
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
}
