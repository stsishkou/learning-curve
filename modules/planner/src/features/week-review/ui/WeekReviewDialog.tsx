import { fmtDay, fmtHours, fmtRatio, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  DAY,
  goalsBetween,
  hm,
  isSession,
  MIN_LOGGED,
  NOTE_MAX,
  parseLocal,
  weekReview,
  ymd,
  type ModuleGoal,
  type Plan,
  type PlanChange,
  type PlanEvent,
} from '@lc/plan-domain'
import { ArrowRight, Button, calendarColor, Dot, FOOT, INPUT, META, Menu, Modal, TITLE } from '@lc/ui'
import { useId, useState, type ReactNode } from 'react'

import type { SessionActions } from '../../../shared/lib'

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
  /** Present where the plan can be changed: what can be done to each missed session */
  actions?: SessionActions | undefined
  /** Present where the plan can be changed: keeps the review with its note. Rejects with the reason */
  onChange?: ((change: PlanChange) => Promise<void>) | undefined
  onClose: () => void
}

/**
 * The end-of-week look back: hours done against the plan, the time they really took, which of the week's goals
 * were met, what was missed, and the goals the next week brings.
 */
export function WeekReviewDialog({ monday, now, ...rest }: Props) {
  return (
    <Modal open={monday !== null} onClose={rest.onClose}>
      {monday !== null && now !== null && (
        // Remounts for another week, so the note starts from that week's own.
        <Review key={monday} monday={monday} now={now} {...rest} />
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

function Review({
  plan,
  monday,
  now,
  onCatchUp,
  onNextWeek,
  actions,
  onChange,
  onClose,
}: Props & { monday: number; now: number }) {
  const review = weekReview(plan, monday, now)
  const missed = plan.events
    .filter((e) => {
      const start = parseLocal(e.start)
      return isSession(e) && !e.done && start >= monday && start < monday + 7 * DAY && parseLocal(e.end) <= now
    })
    .toSorted((a, b) => a.start.localeCompare(b.start))
  const next = goalsBetween(plan, monday + 7 * DAY, monday + 14 * DAY)
  const met = review.goals.filter((goal) => goal.done === goal.sessions).length
  const { accuracy } = review
  // The week's pace once enough of it is logged; until then, how much of it is.
  const paceNote =
    accuracy.pace !== null
      ? m.pace_note_logged({ ratio: fmtRatio(accuracy.pace), count: accuracy.logged })
      : accuracy.done
        ? `${m.dash_pace_logged({ logged: accuracy.logged, done: accuracy.done })} · ${m.dash_pace_wait({ count: MIN_LOGGED })}`
        : ''
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
        <Tile label={m.review_spent()} note={paceNote}>
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
          <span className="min-w-0 flex-1 text-today-ink">
            {m.review_missed({ count: review.missed })}
            {review.skipped > 0 && <span className="text-muted"> · {m.review_skipped({ count: review.skipped })}</span>}
          </span>
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

      {missed.length > 0 && <Missed plan={plan} sessions={missed} actions={actions} />}

      {next.length > 0 && (
        <>
          <h4 className={heading}>{m.review_next()}</h4>
          <Goals plan={plan} goals={next} />
        </>
      )}

      {onChange && <Note plan={plan} week={ymd(monday)} onChange={onChange} />}

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

/** The week's sessions that are over and not done, each with what can still be done to it. */
function Missed({
  plan,
  sessions,
  actions,
}: {
  plan: Plan
  sessions: PlanEvent[]
  actions: SessionActions | undefined
}) {
  const [noSlot, setNoSlot] = useState(false)
  return (
    <>
      <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-0.5">
        {sessions.map((e) => (
          <li
            key={e.uid}
            className="flex min-w-0 items-center gap-2 text-[13.5px]"
            style={calendarColor(plan.calendars.find((c) => c.id === e.calendar)?.color)}
          >
            <Dot className="size-2 flex-none -translate-y-px" />
            <span className="min-w-0 flex-1 truncate" data-tip={e.title}>
              {e.title}
            </span>
            <span className="flex-none text-[12.5px] text-muted tabular-nums">
              {fmtDay(parseLocal(e.start))} {hm(parseLocal(e.start))}
            </span>
            {actions && (
              <Menu
                label={m.session_actions({ title: e.title })}
                className="size-7! rounded-md! border-0! bg-transparent! text-[15px]! shadow-none!"
                items={[
                  { id: 'done', label: m.mark_done(), run: () => actions.done(e.uid) },
                  { id: 'skip', label: m.skip_session(), run: () => actions.skip(e.uid) },
                  {
                    id: 'move',
                    label: m.move_next_free(),
                    run: () => {
                      const slot = { uid: e.uid, calendar: e.calendar, s: parseLocal(e.start), e: parseLocal(e.end) }
                      setNoSlot(!actions.move(slot))
                    },
                  },
                ]}
              />
            )}
          </li>
        ))}
      </ul>
      {noSlot && (
        <p className="mt-1 text-[12.5px] text-today-ink" role="status">
          {m.free_slot_none()}
        </p>
      )}
    </>
  )
}

/** One line on how the week went, kept with the week's numbers; saving again replaces it. */
function Note({ plan, week, onChange }: { plan: Plan; week: string; onChange: (change: PlanChange) => Promise<void> }) {
  const id = useId()
  const saved = plan.weekNotes?.find((note) => note.week === week)
  const [text, setText] = useState(saved?.note ?? '')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await onChange({ type: 'week.review', week, note: text })
      setStatus(m.review_saved())
    } catch (err) {
      setStatus(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="mt-4 grid gap-1.5 border-t border-line-soft pt-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <label htmlFor={id} className="text-[13px] font-medium">
        {m.review_note()}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          className={`${INPUT} min-w-0 flex-1 basis-60`}
          value={text}
          maxLength={NOTE_MAX}
          placeholder={m.review_note_hint()}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => {
            setText(e.target.value)
            setStatus('')
          }}
        />
        <Button type="submit" disabled={busy}>
          {saved ? m.review_update() : m.review_save()}
        </Button>
      </div>
      <p className="min-h-[1lh] text-[12.5px] text-muted" role="status">
        {status}
      </p>
    </form>
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
