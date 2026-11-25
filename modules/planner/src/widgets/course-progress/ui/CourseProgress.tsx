import { fmtHours, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { courseProgress, parseLocal, type Plan, type PlanEvent } from '@lc/plan-domain'
import { calendarColor, ProgressRing } from '@lc/ui'

interface Props {
  plan: Plan
  /** Called with a course's next open session when its "next" link is clicked */
  onSelect: (e: PlanEvent) => void
}

/** How far each course is: hours marked done out of the hours planned, and the next open session. */
export function CourseProgress({ plan, onSelect }: Props) {
  const courses = courseProgress(plan)
  const hours = courses.reduce((sum, c) => sum + c.hours, 0)
  const doneHours = courses.reduce((sum, c) => sum + c.doneHours, 0)

  return (
    <div>
      <div className="font-display text-[30px] leading-none font-bold tracking-[-0.02em] tabular-nums">
        {hours ? Math.round((doneHours / hours) * 100) : 0}%
        <small className="ml-1.5 font-sans text-[14px] leading-normal font-medium text-muted">
          {m.progress_of({ done: fmtHours(doneHours), total: fmtHours(hours) })}
        </small>
      </div>
      <ul className="mt-3.5 grid grid-cols-[minmax(0,1fr)] gap-3">
        {courses.map((c) => (
          <li key={c.calendar.id} className="flex items-center gap-3" style={calendarColor(c.calendar.color)}>
            <ProgressRing
              value={c.hours ? c.doneHours / c.hours : 0}
              label={m.progress_of({ done: fmtHours(c.doneHours), total: fmtHours(c.hours) })}
            >
              {c.doneSessions === c.sessions ? '✓' : `${Math.round((c.doneHours / c.hours) * 100)}`}
            </ProgressRing>
            <div className="min-w-0 flex-1 text-[13px]/[1.35]">
              <b className="block truncate font-semibold">{c.calendar.name}</b>
              <span className="block text-[12px] text-muted tabular-nums">
                {m.progress_sessions({ done: c.doneSessions, total: c.sessions })} ·{' '}
                {m.progress_finish({ date: fmtShort(parseLocal(c.finish)) })}
                {Math.abs(c.pace - 1) >= 0.05 &&
                  ` · ${m.pace_note_logged({ pace: c.pace.toFixed(1), count: c.accuracy.logged })}`}
              </span>
              {c.next && (
                <button
                  type="button"
                  className="block max-w-full truncate text-left text-[12px] text-focus hover:underline"
                  onClick={() => c.next && onSelect(c.next)}
                >
                  {m.next_label()}: {c.next.title.replace(/^[^—]+— /, '')}
                </button>
              )}
            </div>
          </li>
        ))}
        {!courses.length && <li className="text-[13px] text-muted">{m.no_study_events()}</li>}
      </ul>
      <p className="mt-4 border-t border-line-soft pt-3.5 text-[12.5px] text-muted">{m.progress_hint()}</p>
    </div>
  )
}
