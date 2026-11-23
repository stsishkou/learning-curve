import { fmtHours, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, goalsBetween, weekReview, type ModuleGoal, type Plan } from '@lc/plan-domain'
import { ArrowRight, Button, calendarColor, Dot, FOOT, META, Modal, TITLE } from '@lc/ui'
import type { ReactNode } from 'react'

interface Props {
  plan: Plan
  /** Monday of the week to review, Minsk wall-clock ms; null keeps the dialog closed */
  monday: number | null
  /** Minsk wall-clock ms; null before the clock is known */
  now: number | null
  /** Present when the plan can be edited: opens the catch-up scenarios for the sessions that were missed */
  onCatchUp?: (() => void) | undefined
  /** Shows the following week in the calendar */
  onNextWeek: () => void
  onClose: () => void
}

/**
 * The end-of-week look back: hours done against the plan, the time they really took, which of the week's goals
 * were met, what was missed, and the goals the next week brings.
 */
export function WeekReviewDialog({ plan, monday, now, onCatchUp, onNextWeek, onClose }: Props) {
  return (
    <Modal open={monday !== null} onClose={onClose}>
      {monday !== null && now !== null && (
        <Review plan={plan} monday={monday} now={now} onCatchUp={onCatchUp} onNextWeek={onNextWeek} onClose={onClose} />
      )}
    </Modal>
  )
}

function Goals({ plan, goals }: { plan: Plan; goals: ModuleGoal[] }) {
  return (
    <ul className="mt-1.5 grid gap-1.5 text-[13.5px]">
      {goals.map((goal) => {
        const met = goal.done === goal.sessions
        return (
          <li
            key={`${goal.calendar}-${goal.title}`}
            className="flex items-baseline gap-2"
            style={calendarColor(plan.calendars.find((c) => c.id === goal.calendar)?.color)}
          >
            <Dot className="size-[9px] -translate-y-px" />
            <span className="min-w-0 flex-1">{goal.title}</span>
            <em className={`flex-none not-italic tabular-nums ${met ? 'text-done-ink' : 'text-muted'}`}>
              {met ? `✓ ${m.done()}` : `${goal.done}/${goal.sessions}`}
            </em>
          </li>
        )
      })}
    </ul>
  )
}

function Review({ plan, monday, now, onCatchUp, onNextWeek, onClose }: Props & { monday: number; now: number }) {
  const review = weekReview(plan, monday, now)
  const next = goalsBetween(plan, monday + 7 * DAY, monday + 14 * DAY)
  const met = review.goals.filter((goal) => goal.done === goal.sessions).length
  const pace = review.done ? review.spent / review.done : 1
  const heading = 'mt-4 text-[12px] font-semibold tracking-wide text-muted uppercase'

  return (
    <>
      <h3 className={TITLE}>{m.review_title()}</h3>
      <div className={META}>
        {fmtShort(monday)} – {fmtShort(monday + 6 * DAY)}
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label={m.review_hours()} note={m.dash_of({ total: fmtHours(review.planned) })}>
          {fmtHours(review.done)}
        </Tile>
        <Tile label={m.review_spent()} note={m.pace_note({ pace: pace.toFixed(2).replace(/0$/, '') })}>
          {fmtHours(review.spent)}
        </Tile>
        <Tile label={m.review_sessions()} note={m.dash_of({ total: review.sessions })}>
          {review.doneSessions}
        </Tile>
        <Tile label={m.review_goals()} note={m.dash_of({ total: review.goals.length })}>
          {met}
        </Tile>
      </div>

      <h4 className={heading}>{m.goals_week()}</h4>
      {review.goals.length ? (
        <Goals plan={plan} goals={review.goals} />
      ) : (
        <p className="mt-1.5 text-[13.5px] text-muted">{m.goals_week_none()}</p>
      )}

      {review.missed > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line px-3.5 py-2 text-[13.5px]">
          <span className="min-w-0 flex-1 text-today-ink">{m.review_missed({ count: review.missed })}</span>
          {onCatchUp && (
            <button
              type="button"
              className="font-semibold text-focus hover:underline"
              onClick={() => {
                onClose()
                onCatchUp()
              }}
            >
              {m.catchup()}
            </button>
          )}
        </p>
      )}

      {next.length > 0 && (
        <>
          <h4 className={heading}>{m.review_next()}</h4>
          <Goals plan={plan} goals={next} />
        </>
      )}

      <div className={FOOT}>
        <Button
          className="flex items-center gap-1.5"
          onClick={() => {
            onClose()
            onNextWeek()
          }}
        >
          {m.review_go_next()} <ArrowRight size={15} aria-hidden />
        </Button>
        <Button primary onClick={onClose}>
          {m.close()}
        </Button>
      </div>
    </>
  )
}

function Tile({ label, note, children }: { label: string; note: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-bg px-3 py-2">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="font-display text-[19px]/[1.25] font-semibold tabular-nums">{children}</div>
      <div className="truncate text-[11.5px] text-muted">{note}</div>
    </div>
  )
}
