import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  deadlineChange,
  deadlineOf,
  isSession,
  nextDeadline,
  parseLocal,
  type Plan,
  type PlanChange,
} from '@lc/plan-domain'
import { Button, FIELD, FOOT, INPUT, META, Modal, TITLE } from '@lc/ui'
import { useId, useState, type SubmitEvent } from 'react'

interface Props {
  plan: Plan
  /** Minsk wall-clock ms; null before the clock is known */
  now: number | null
  open: boolean
  /** Stores the changes in order. Rejects with the reason when they cannot be stored: the dialog shows it */
  onApply: (changes: PlanChange[]) => Promise<void>
  onClose: () => void
}

const dayText = (day: string) => fmtDay(parseLocal(`${day}T00:00`))

/** Which deadline the days on the plan count to, and the day of that course's deadline. */
export function CountdownDialog({ open, ...form }: Props) {
  return (
    <Modal open={open} onClose={form.onClose}>
      {open && <CountdownForm {...form} />}
    </Modal>
  )
}

function CountdownForm({ plan, now, onApply, onClose }: Omit<Props, 'open'>) {
  const ids = useId()
  const named = plan.meta.countdown
  const chosen = named !== undefined && plan.calendars.some((c) => c.id === named) ? named : ''
  // '' counts to the nearest deadline of any course.
  const [target, setTarget] = useState(chosen)
  const [day, setDay] = useState(() => (chosen ? (deadlineOf(plan, chosen) ?? '') : ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The personal calendars have no sessions to finish by a day.
  const courses = plan.calendars.filter((c) =>
    plan.events.some((e) => e.calendar === c.id && (isSession(e) || e.kind === 'milestone')),
  )
  const nearest = nextDeadline(plan, now ?? 0)
  const nearestName = nearest && plan.calendars.find((c) => c.id === nearest.calendar)?.name

  function choose(id: string) {
    setTarget(id)
    setDay(id ? (deadlineOf(plan, id) ?? '') : '')
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    const changes: PlanChange[] = []
    if (target !== chosen) changes.push({ type: 'plan.countdown', calendar: target || null })
    const deadline = target ? deadlineChange(plan, target, day || null) : null
    if (deadline) changes.push(deadline)
    if (!changes.length) {
      onClose()
      return
    }
    setBusy(true)
    try {
      await onApply(changes)
      onClose()
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-3" onSubmit={(e) => void submit(e)}>
      <h3 className={TITLE}>{m.countdown_title()}</h3>
      <p className={META}>{m.countdown_hint()}</p>
      <div className={FIELD}>
        <label htmlFor={`${ids}-target`}>{m.countdown_target()}</label>
        <select id={`${ids}-target`} className={INPUT} value={target} onChange={(e) => choose(e.target.value)}>
          <option value="">{m.countdown_nearest()}</option>
          {courses.map((c) => {
            const deadline = deadlineOf(plan, c.id)
            return (
              <option key={c.id} value={c.id}>
                {deadline
                  ? m.countdown_option({ name: c.name, date: dayText(deadline) })
                  : m.countdown_option_none({ name: c.name })}
              </option>
            )
          })}
        </select>
      </div>
      {target ? (
        <div className={FIELD}>
          <label htmlFor={`${ids}-day`}>{m.countdown_deadline()}</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`${ids}-day`}
              className={`${INPUT} w-auto flex-1`}
              type="date"
              value={day}
              aria-describedby={`${ids}-day-hint`}
              onChange={(e) => setDay(e.target.value)}
            />
            {day && <Button onClick={() => setDay('')}>{m.countdown_remove()}</Button>}
          </div>
          <p id={`${ids}-day-hint`}>{m.countdown_deadline_hint()}</p>
        </div>
      ) : (
        <p className="text-[13.5px] text-muted">
          {nearest && nearestName
            ? m.countdown_nearest_now({ name: nearestName, date: dayText(nearest.day) })
            : m.countdown_none_ahead()}
        </p>
      )}
      {error && (
        <p className="text-[13px] text-today-ink" role="alert">
          {error}
        </p>
      )}
      <div className={FOOT}>
        <Button onClick={onClose}>{m.cancel()}</Button>
        <Button primary type="submit" disabled={busy}>
          {m.save()}
        </Button>
      </div>
    </form>
  )
}
