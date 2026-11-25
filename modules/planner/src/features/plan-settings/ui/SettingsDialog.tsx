import { m } from '@lc/i18n/messages'
import { BUDGET_RANGE, DAY_LIMIT_RANGE, type Plan, type PlanChange } from '@lc/plan-domain'
import { Button, FIELD, FOOT, INPUT, META, Modal, TITLE } from '@lc/ui'
import { useId, useState, type SubmitEvent } from 'react'

import { REMINDER_LEADS } from '../../../shared/lib'

interface Props {
  plan: Plan
  open: boolean
  /** Present where the plan can be changed: stores the changes in order, rejecting with the reason */
  onApply?: ((changes: PlanChange[]) => Promise<void>) | undefined
  /** Present where the browser can show reminders: how many minutes before a start they come, and its setter */
  reminder?: { lead: number; setLead: (minutes: number) => void } | undefined
  onClose: () => void
}

// Shown only once the person has left a field with a value out of range or submitted it.
const CHECKED = `${INPUT} user-invalid:border-today`

/** The limits the plan keeps to, and how early a reminder comes. Nothing changes until Save. */
export function SettingsDialog({ open, ...form }: Props) {
  return (
    <Modal open={open} onClose={form.onClose}>
      {open && <SettingsForm {...form} />}
    </Modal>
  )
}

function SettingsForm({ plan, onApply, reminder, onClose }: Omit<Props, 'open'>) {
  const ids = useId()
  const { weeklyBudgetHours, dayLimit } = plan.meta
  const [budget, setBudget] = useState(String(weeklyBudgetHours))
  const [limit, setLimit] = useState(dayLimit === undefined ? '' : String(dayLimit))
  const [lead, setLead] = useState(reminder?.lead ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    if (reminder && lead !== reminder.lead) reminder.setLead(lead)
    const changes: PlanChange[] = []
    const hours = Number(budget)
    if (onApply && hours !== weeklyBudgetHours) changes.push({ type: 'plan.budget', hours })
    const nextLimit = limit.trim() === '' ? null : Number(limit)
    if (onApply && nextLimit !== (dayLimit ?? null)) changes.push({ type: 'plan.dayLimit', hours: nextLimit })
    if (!onApply || !changes.length) {
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
    <form className="grid gap-4" aria-labelledby={`${ids}-title`} onSubmit={(e) => void submit(e)}>
      <div>
        <h3 id={`${ids}-title`} className={TITLE}>
          {m.settings()}
        </h3>
        <p className={META}>{m.settings_hint()}</p>
      </div>
      {onApply && (
        <>
          <div className={FIELD}>
            <label htmlFor={`${ids}-budget`}>{m.settings_budget()}</label>
            <input
              id={`${ids}-budget`}
              name="budget"
              className={`${CHECKED} w-32`}
              type="number"
              inputMode="decimal"
              enterKeyHint="done"
              required
              min={BUDGET_RANGE.min}
              max={BUDGET_RANGE.max}
              step={0.5}
              value={budget}
              aria-describedby={`${ids}-budget-hint`}
              onChange={(e) => setBudget(e.target.value)}
            />
            <p id={`${ids}-budget-hint`}>{m.settings_budget_hint({ min: BUDGET_RANGE.min, max: BUDGET_RANGE.max })}</p>
          </div>
          <div className={FIELD}>
            <label htmlFor={`${ids}-limit`}>{m.settings_day_limit()}</label>
            <input
              id={`${ids}-limit`}
              name="dayLimit"
              className={`${CHECKED} w-32`}
              type="number"
              inputMode="decimal"
              enterKeyHint="done"
              min={DAY_LIMIT_RANGE.min}
              max={DAY_LIMIT_RANGE.max}
              step={0.5}
              value={limit}
              aria-describedby={`${ids}-limit-hint`}
              onChange={(e) => setLimit(e.target.value)}
            />
            <p id={`${ids}-limit-hint`}>
              {m.settings_day_limit_hint({ min: DAY_LIMIT_RANGE.min, max: DAY_LIMIT_RANGE.max })}
            </p>
          </div>
        </>
      )}
      {reminder && (
        <fieldset className={FIELD} aria-describedby={`${ids}-lead-hint`}>
          <legend>{m.settings_reminder()}</legend>
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_LEADS.map((minutes) => (
              <label
                key={minutes}
                className="inline-flex min-h-8 cursor-pointer items-center rounded-full border border-line-soft px-3 text-[13px] text-muted tabular-nums hover:text-ink has-checked:border-focus has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
              >
                <input
                  type="radio"
                  name="lead"
                  className="sr-only"
                  value={minutes}
                  checked={lead === minutes}
                  onChange={() => setLead(minutes)}
                />
                {m.settings_minutes({ count: minutes })}
              </label>
            ))}
          </div>
          <p id={`${ids}-lead-hint`}>{m.settings_reminder_hint()}</p>
        </fieldset>
      )}
      {error && (
        <p className="text-[13px] text-today-ink" role="alert">
          {error}
        </p>
      )}
      <div className={FOOT}>
        <Button type="button" onClick={onClose}>
          {m.cancel()}
        </Button>
        <Button primary type="submit" disabled={busy}>
          {m.save()}
        </Button>
      </div>
    </form>
  )
}
