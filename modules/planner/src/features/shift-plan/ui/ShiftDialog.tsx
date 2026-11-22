import { m } from '@lc/i18n/messages'
import { shiftTargets, type Plan, type PlanChange } from '@lc/plan-domain'
import { Button, FIELD, FOOT, INPUT, META, Modal, TITLE } from '@lc/ui'
import { useState, type FormEvent } from 'react'

interface Props {
  plan: Plan
  /** The first day to move, `YYYY-MM-DD`; null keeps the dialog closed */
  from: string | null
  /** Rejects with the reason when the change cannot be stored */
  onChange: (change: PlanChange) => Promise<void>
  onClose: () => void
}

/** Catching up after time off: moves the sessions that are not done yet by a number of days. */
export function ShiftDialog({ plan, from, onChange, onClose }: Props) {
  return (
    <Modal open={from !== null} onClose={onClose}>
      {from !== null && <ShiftForm key={from} plan={plan} from={from} onChange={onChange} onClose={onClose} />}
    </Modal>
  )
}

function ShiftForm({ plan, from: initial, onChange, onClose }: Props & { from: string }) {
  const [calendar, setCalendar] = useState('')
  const [from, setFrom] = useState(initial)
  const [days, setDays] = useState(7)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const count = shiftTargets(plan, { calendar: calendar || undefined, from }).length

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await onChange({ type: 'events.shift', calendar: calendar || undefined, from, days })
      onClose()
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-3" onSubmit={(e) => void submit(e)}>
      <h3 className={TITLE}>{m.shift_plan()}</h3>
      <div className={META}>{m.shift_hint()}</div>
      <label className={FIELD}>
        {m.field_calendar()}
        <select className={INPUT} value={calendar} onChange={(e) => setCalendar(e.target.value)}>
          <option value="">{m.shift_all()}</option>
          {plan.calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={FIELD}>
          {m.shift_from()}
          <input className={INPUT} type="date" value={from} required onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className={FIELD}>
          {m.shift_days()}
          <input
            className={INPUT}
            type="number"
            min={-366}
            max={366}
            step={1}
            value={days}
            required
            onChange={(e) => setDays(Math.trunc(Number(e.target.value)))}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setDays(1)}>{m.shift_day_later()}</Button>
        <Button onClick={() => setDays(7)}>{m.shift_week_later()}</Button>
        <Button onClick={() => setDays(-7)}>{m.shift_week_earlier()}</Button>
      </div>
      <p className="text-[13.5px] text-muted" role="status">
        {m.shift_count({ count })}
      </p>
      {error && (
        <p className="text-[13px] text-today" role="alert">
          {error}
        </p>
      )}
      <div className={`${FOOT} mt-1`}>
        <Button onClick={onClose}>{m.cancel()}</Button>
        <Button primary type="submit" disabled={busy || !count || !days}>
          {m.shift_apply()}
        </Button>
      </div>
    </form>
  )
}
