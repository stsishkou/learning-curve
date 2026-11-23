import { fmtDay, fmtMonth } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  DAY,
  courseProgress,
  goalsBetween,
  monthGoals,
  nextDeadline,
  parseLocal,
  startOfMonth,
  type ModuleGoal,
  type Plan,
} from '@lc/plan-domain'
import { ArrowRight, calendarColor, Dot } from '@lc/ui'

interface Props {
  plan: Plan
  /** Monday of the week on screen, Minsk wall-clock ms */
  weekStart: number
  /** Opens the review of that week */
  onReview: () => void
}

const HEADING = 'text-[12px] font-semibold tracking-wide text-muted uppercase'

/** One module as a line of a checklist: ticked once every one of its sessions is done. */
function GoalRow({ plan, goal }: { plan: Plan; goal: ModuleGoal }) {
  const met = goal.done === goal.sessions
  const color = plan.calendars.find((c) => c.id === goal.calendar)?.color
  return (
    <li className="flex items-baseline gap-2" style={calendarColor(color)}>
      <Dot className="size-[9px] -translate-y-px" />
      <span className={`min-w-0 flex-1 ${met ? 'text-muted line-through decoration-done' : ''}`}>{goal.title}</span>
      <em className={`flex-none not-italic tabular-nums ${met ? 'text-done-ink' : 'text-muted'}`}>
        {met ? '✓' : `${goal.done}/${goal.sessions}`}
      </em>
    </li>
  )
}

/**
 * The plan as goals, from the deadline down to the week: the modules that end this week, what the month asks of
 * each course, and how far the certificates are. Nothing is entered by hand: the goals follow from the schedule
 * and tick themselves as sessions are marked done.
 */
export function GoalLadder({ plan, weekStart, onReview }: Props) {
  const week = goalsBetween(plan, weekStart, weekStart + 7 * DAY)
  // The month the week mostly belongs to: the one of its Thursday.
  const monthStart = startOfMonth(weekStart + 3 * DAY)
  const month = monthGoals(plan, monthStart, startOfMonth(monthStart, 1))
  const deadline = nextDeadline(plan, weekStart)
  const course = deadline && courseProgress(plan).find((c) => c.calendar.id === deadline.calendar)

  return (
    <div className="grid gap-3.5 text-[13px]/[1.4]">
      <section>
        <h3 className={HEADING}>{m.goals_week()}</h3>
        {week.length ? (
          <ul className="mt-1.5 grid gap-1.5">
            {week.map((goal) => (
              <GoalRow key={`${goal.calendar}-${goal.title}`} plan={plan} goal={goal} />
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-muted">{m.goals_week_none()}</p>
        )}
      </section>
      {month.length > 0 && (
        <section>
          <h3 className={HEADING}>{fmtMonth(monthStart)}</h3>
          <ul className="mt-1.5 grid gap-1.5">
            {month.map((goal) => {
              const calendar = plan.calendars.find((c) => c.id === goal.calendar)
              return (
                <li key={goal.calendar} className="flex items-baseline gap-2" style={calendarColor(calendar?.color)}>
                  <Dot className="size-[9px] -translate-y-px" />
                  <span className="min-w-0 flex-1">
                    {calendar?.name}
                    {goal.completes && <span className="text-muted"> · {m.goals_course_ends()}</span>}
                  </span>
                  <em
                    className={`flex-none not-italic tabular-nums ${goal.doneModules === goal.modules ? 'text-done-ink' : 'text-muted'}`}
                  >
                    {m.goals_modules({ done: goal.doneModules, total: goal.modules })}
                  </em>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {deadline && course && (
        <p className="text-muted">
          {m.goals_deadline({
            date: fmtDay(parseLocal(`${deadline.day}T00:00`)),
            name: course.calendar.name,
            percent: Math.round((course.doneHours / course.hours) * 100),
          })}
        </p>
      )}
      <button
        type="button"
        className="flex items-center gap-1 justify-self-start font-semibold text-focus hover:underline"
        onClick={onReview}
      >
        {m.review_open()} <ArrowRight size={14} aria-hidden />
      </button>
    </div>
  )
}
