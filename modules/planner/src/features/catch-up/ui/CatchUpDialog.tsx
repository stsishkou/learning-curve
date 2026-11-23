import { fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  catchUpScenarios,
  planOutlook,
  withMoves,
  type CatchUpScenario,
  type Plan,
  type PlanChange,
  type PlanOutlook,
} from '@lc/plan-domain'
import { Button, FOOT, META, Modal, TITLE } from '@lc/ui'
import { useMemo, useState } from 'react'

interface Props {
  plan: Plan
  /** The parent owns it and sets it to false in `onClose` */
  open: boolean
  /** Minsk wall-clock ms; null before the clock is known */
  now: number | null
  /** Stores one change. Rejects with the reason when it cannot be stored: the dialog shows it */
  onChange: (change: PlanChange) => Promise<void>
  /** Opens the dialog that shifts the plan by a number of days, for a move none of the scenarios makes */
  onShift: () => void
  onClose: () => void
}

type Choice = CatchUpScenario['id'] | 'keep'
type Option = Omit<CatchUpScenario, 'id'> & { id: Choice; outlook: PlanOutlook }

const TEXT: Record<Choice, { title: () => string; hint: () => string }> = {
  keep: { title: m.catchup_keep, hint: m.catchup_keep_hint },
  push: { title: m.catchup_push, hint: m.catchup_push_hint },
  squeeze: { title: m.catchup_squeeze, hint: m.catchup_squeeze_hint },
  pace: { title: m.catchup_pace, hint: m.catchup_pace_hint },
}

/**
 * Getting back on the plan after missed sessions, as a choice between whole scenarios. Each one is shown with
 * what it costs: the day the plan ends, the room left before the certificate deadline and the heaviest week.
 */
export function CatchUpDialog({ plan, open, now, onChange, onShift, onClose }: Props) {
  return (
    <Modal open={open} size="wide" onClose={onClose}>
      {open && now !== null && (
        <Scenarios plan={plan} now={now} onChange={onChange} onShift={onShift} onClose={onClose} />
      )}
    </Modal>
  )
}

function Scenarios({ plan, now, onChange, onShift, onClose }: Omit<Props, 'open' | 'now'> & { now: number }) {
  const { keep, options } = useMemo(() => {
    const asIs: Option = { id: 'keep', moves: [], unplaced: 0, outlook: planOutlook(plan, now) }
    const scenarios = catchUpScenarios(plan, now).map((scenario): Option => ({
      ...scenario,
      outlook: planOutlook(withMoves(plan, scenario.moves), now),
    }))
    return { keep: asIs, options: [asIs, ...scenarios] }
  }, [plan, now])
  const [choice, setChoice] = useState<Choice>(options[1]?.id ?? 'keep')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const chosen = options.find((option) => option.id === choice) ?? keep
  const budget = plan.meta.weeklyBudgetHours

  async function apply() {
    setBusy(true)
    try {
      await onChange({ type: 'events.move', moves: chosen.moves, paced: chosen.paced })
      onClose()
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h3 className={TITLE}>{m.catchup_title()}</h3>
      <div className={META}>
        {options.length === 1
          ? m.catchup_nothing()
          : keep.outlook.missed
            ? m.catchup_hint({ count: keep.outlook.missed })
            : m.catchup_hint_pace()}
      </div>
      <div className="mt-4 grid gap-2.5" role="radiogroup" aria-label={m.catchup_title()}>
        {options.map((option) => (
          <label
            key={option.id}
            className="grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-xl border border-line px-3.5 py-3 has-checked:border-focus has-checked:bg-surface-2"
          >
            <input
              type="radio"
              name="catch-up"
              className="mt-1 accent-(--focus)"
              checked={choice === option.id}
              onChange={() => setChoice(option.id)}
            />
            <span className="min-w-0">
              <b className="block text-[14.5px] font-semibold">{TEXT[option.id].title()}</b>
              <span className="block text-[13px] text-muted">{TEXT[option.id].hint()}</span>
              <Numbers outlook={option.outlook} budget={budget} moved={option.moves.length} />
              {option.unplaced > 0 && (
                <span className="mt-1 block text-[12.5px] text-today-ink">
                  {m.catchup_unplaced({ count: option.unplaced })}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-[13px] text-today-ink" role="alert">
          {error}
        </p>
      )}
      <div className={FOOT}>
        <Button
          className="mr-auto"
          onClick={() => {
            onClose()
            onShift()
          }}
        >
          {m.catchup_manual()}
        </Button>
        <Button onClick={onClose}>{m.cancel()}</Button>
        <Button primary disabled={busy || !chosen.moves.length} onClick={() => void apply()}>
          {m.catchup_apply()}
        </Button>
      </div>
    </>
  )
}

function Numbers({ outlook, budget, moved }: { outlook: PlanOutlook; budget: number; moved: number }) {
  const { finish, deadlineMargin: margin, peakWeek, overWeeks } = outlook
  const cell = 'rounded-lg bg-bg px-2.5 py-1.5'
  const label = 'block text-[11.5px] text-muted'
  return (
    <span className="mt-2 grid grid-cols-2 gap-1.5 text-[13px] tabular-nums md:grid-cols-4">
      <span className={cell}>
        <span className={label}>{m.catchup_finish()}</span>
        {finish === null ? '—' : fmtDay(finish)}
      </span>
      <span className={cell}>
        <span className={label}>{m.catchup_deadline()}</span>
        {margin === null ? (
          '—'
        ) : margin < 0 ? (
          <span className="text-today-ink">▼ {m.catchup_late({ count: -margin })}</span>
        ) : (
          <span>✓ {m.catchup_spare({ count: margin })}</span>
        )}
      </span>
      <span className={cell}>
        <span className={label}>{m.catchup_peak()}</span>
        <span className={peakWeek > budget ? 'text-today-ink' : ''}>
          {fmtHours(peakWeek)}
          {overWeeks > 0 && ` · ${m.catchup_over({ count: overWeeks })}`}
        </span>
      </span>
      <span className={cell}>
        <span className={label}>{m.catchup_moved()}</span>
        {moved}
      </span>
    </span>
  )
}
