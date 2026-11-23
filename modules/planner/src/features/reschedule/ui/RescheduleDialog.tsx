import { fmtDay, fmtHours, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  deadlineOf,
  defaultStudyHours,
  parseLocal,
  previewUpdate,
  shiftTargets,
  type Plan,
  type PlanChange,
  type RebalanceReason,
  type RebalanceRequest,
  type RebalanceResult,
} from '@lc/plan-domain'
import { Button, FIELD, FOOT, INPUT, META, Modal, Segmented, TITLE } from '@lc/ui'
import { useId, useMemo, useState, type SubmitEvent } from 'react'

import { RuleWarningList } from '../../../shared/ui'
import { deadlineChange } from '../model/deadline-change'
import { useRebalance, type Rebalance } from '../model/use-rebalance'

interface Props {
  plan: Plan
  /** The first day to move, `YYYY-MM-DD`; null keeps the dialog closed */
  from: string | null
  /** Stores the changes in order, all or none. Rejects with the reason when they cannot be stored: the dialog shows it */
  onApply: (changes: PlanChange[]) => Promise<void>
  /** Works out a re-balance of one calendar; without it the dialog only moves */
  rebalance?: Rebalance | undefined
  onClose: () => void
}

type Mode = 'move' | 'rebalance'

const PACE_OPTIONS = [
  { key: '1/3', perDay: 1 / 3, label: () => m.reschedule_pace_1_3() },
  { key: '1/2', perDay: 1 / 2, label: () => m.reschedule_pace_1_2() },
  { key: '1', perDay: 1, label: () => m.reschedule_pace_1() },
  { key: '3/2', perDay: 3 / 2, label: () => m.reschedule_pace_3_2() },
  { key: '2', perDay: 2, label: () => m.reschedule_pace_2() },
  { key: '3', perDay: 3, label: () => m.reschedule_pace_3() },
] as const
type Pace = (typeof PACE_OPTIONS)[number]['key']

const dayOf = (ymd: string) => parseLocal(`${ymd}T00:00`)
const CHECK = 'flex items-center gap-2 text-[13.5px] text-ink'

/**
 * Reschedules the open sessions from a day on: moves them by days and hours, or re-balances one calendar at a pace or
 * towards its deadline, with the result worked out on the host and shown before anything is stored.
 */
export function RescheduleDialog({ plan, from, onApply, rebalance, onClose }: Props) {
  return (
    <Modal open={from !== null} size="wide" onClose={onClose}>
      {from !== null && (
        <RescheduleForm key={from} plan={plan} from={from} onApply={onApply} rebalance={rebalance} onClose={onClose} />
      )}
    </Modal>
  )
}

function RescheduleForm({ plan, from: initial, onApply, rebalance, onClose }: Props & { from: string }) {
  const ids = useId()
  const [calendar, setCalendar] = useState('')
  const [from, setFrom] = useState(initial)
  const [deadline, setDeadline] = useState('')
  const [mode, setMode] = useState<Mode>('move')
  const [days, setDays] = useState(7)
  const [hours, setHours] = useState(0)
  const [pace, setPace] = useState<Pace>('1')
  const [fit, setFit] = useState(false)
  const [study, setStudy] = useState(() => defaultStudyHours(plan))
  const [overBudget, setOverBudget] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const rebalancing = mode === 'rebalance' && rebalance !== undefined
  // A deadline on or before the first day cannot be aimed at: it is kept, but not sent.
  const aim = deadline > from ? deadline : ''
  const fitting = fit && aim !== ''
  const perDay = PACE_OPTIONS.find((p) => p.key === pace)?.perDay ?? 1
  const request = useMemo<RebalanceRequest | null>(
    () =>
      rebalancing && calendar && from && study.from < study.to
        ? {
            calendar,
            from,
            deadline: aim || undefined,
            target: fitting ? { mode: 'deadline' } : { mode: 'pace', perDay },
            overBudget,
            hours: study,
          }
        : null,
    [rebalancing, calendar, from, aim, fitting, perDay, overBudget, study],
  )
  const outcome = useRebalance(rebalance, plan, request)
  const { result } = outcome
  const moves = useMemo<PlanChange | null>(
    () => (result?.moves.length ? { type: 'events.move', moves: result.moves, reason: 'rebalance', calendar } : null),
    [result, calendar],
  )
  const warnings = useMemo(() => (moves ? previewUpdate(plan, [moves]).warnings : []), [plan, moves])

  const count = shiftTargets(plan, { calendar: calendar || undefined, from }).length
  const deadlineStep = calendar ? deadlineChange(plan, calendar, deadline || null) : null
  const shift: PlanChange = {
    type: 'events.shift',
    calendar: calendar || undefined,
    from,
    ...(days ? { days } : {}),
    ...(hours ? { hours } : {}),
  }
  const ready = rebalancing
    ? request !== null && !outcome.working && result?.report.unplaced === 0 && (moves !== null || deadlineStep !== null)
    : count > 0 && (days !== 0 || hours !== 0)

  function chooseCalendar(id: string) {
    setCalendar(id)
    setDeadline(id ? (deadlineOf(plan, id) ?? '') : '')
    setFit(false)
  }

  function preset(byDays: number, byHours: number) {
    setDays(byDays)
    setHours(byHours)
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    const changes = [deadlineStep, rebalancing ? moves : shift].filter((change) => change !== null)
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
      <h3 className={TITLE}>{m.reschedule()}</h3>
      <div className={META}>{m.reschedule_hint()}</div>
      <div className="sm:grid-cols-2 grid gap-3">
        <label className={FIELD}>
          {m.field_calendar()}
          <select className={INPUT} value={calendar} onChange={(e) => chooseCalendar(e.target.value)}>
            <option value="">{m.shift_all()}</option>
            {plan.calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          {m.shift_from()}
          <input className={INPUT} type="date" value={from} required onChange={(e) => setFrom(e.target.value)} />
        </label>
      </div>
      {calendar && (
        <div className="grid gap-1">
          <label className={FIELD}>
            {m.reschedule_deadline()}
            <input
              className={INPUT}
              type="date"
              value={deadline}
              min={from}
              aria-describedby={`${ids}-deadline`}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <p id={`${ids}-deadline`} className="text-[12.5px] text-muted">
            {m.reschedule_deadline_hint()}
          </p>
        </div>
      )}
      {rebalance && (
        <div>
          <Segmented
            label={m.reschedule_mode()}
            value={mode}
            options={[
              { value: 'move', label: m.reschedule_move() },
              { value: 'rebalance', label: m.reschedule_rebalance() },
            ]}
            onChange={setMode}
          />
        </div>
      )}
      {rebalancing ? (
        calendar ? (
          <>
            <div className="grid gap-1 text-[13px] text-muted">
              <span aria-hidden>{m.reschedule_pace()}</span>
              {/* On a narrow screen the paces scroll sideways rather than squeeze their labels onto several lines. */}
              <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <div className="w-max">
                  <Segmented
                    label={m.reschedule_pace()}
                    value={pace}
                    options={PACE_OPTIONS.map((p) => ({ value: p.key, label: p.label() }))}
                    onChange={setPace}
                  />
                </div>
              </div>
            </div>
            <label className={CHECK}>
              <input type="checkbox" checked={fitting} disabled={!aim} onChange={(e) => setFit(e.target.checked)} />
              {m.reschedule_fit_deadline()}
            </label>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <span className="whitespace-nowrap">{m.reschedule_study_hours()}</span>
                <input
                  className={`${INPUT} w-auto`}
                  type="time"
                  step={1800}
                  value={study.from}
                  required
                  aria-label={m.reschedule_study_from()}
                  onChange={(e) => setStudy((s) => ({ ...s, from: e.target.value }))}
                />
                –
                <input
                  className={`${INPUT} w-auto`}
                  type="time"
                  step={1800}
                  value={study.to}
                  required
                  aria-label={m.reschedule_study_to()}
                  onChange={(e) => setStudy((s) => ({ ...s, to: e.target.value }))}
                />
              </div>
              <label className={CHECK}>
                <input type="checkbox" checked={overBudget} onChange={(e) => setOverBudget(e.target.checked)} />
                {m.reschedule_over_budget({ hours: plan.meta.weeklyBudgetHours })}
              </label>
            </div>
            <Summary {...outcome} />
            <RuleWarningList warnings={warnings} />
          </>
        ) : (
          <p className="text-[13.5px] text-muted" role="status">
            {m.reschedule_need_calendar()}
          </p>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
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
            <label className={FIELD}>
              {m.reschedule_hours()}
              <input
                className={INPUT}
                type="number"
                min={-23.5}
                max={23.5}
                step={0.5}
                value={hours}
                required
                onChange={(e) => setHours(Math.round(Number(e.target.value) * 2) / 2)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => preset(0, 1)}>{m.reschedule_hour_later()}</Button>
            <Button onClick={() => preset(0, -1)}>{m.reschedule_hour_earlier()}</Button>
            <Button onClick={() => preset(1, 0)}>{m.shift_day_later()}</Button>
            <Button onClick={() => preset(7, 0)}>{m.shift_week_later()}</Button>
            <Button onClick={() => preset(-7, 0)}>{m.shift_week_earlier()}</Button>
          </div>
          <p className="text-[13.5px] text-muted" role="status">
            {m.shift_count({ count })}
          </p>
        </>
      )}
      {error && (
        <p className="text-[13px] text-today-ink" role="alert">
          {error}
        </p>
      )}
      <div className={`${FOOT} mt-1`}>
        <Button onClick={onClose}>{m.cancel()}</Button>
        <Button primary type="submit" disabled={busy || !ready}>
          {m.reschedule_apply()}
        </Button>
      </div>
    </form>
  )
}

/** When the course ends then, how heavy it gets, and why nothing better exists. */
function Summary({ result, working, error }: { result: RebalanceResult | null; working: boolean; error: string }) {
  if (error) {
    return (
      <p className="text-[13px] text-today-ink" role="alert">
        {m.reschedule_failed({ reason: error })}
      </p>
    )
  }
  if (!result) {
    return (
      <div className="grid gap-2" role="status" aria-busy={working}>
        <span className="sr-only">{m.reschedule_working()}</span>
        <span className="h-4 w-4/5 rounded bg-surface-2 motion-safe:animate-pulse" />
        <span className="h-4 w-3/5 rounded bg-surface-2 motion-safe:animate-pulse" />
      </div>
    )
  }
  const { report } = result
  const parts = [
    report.finish && report.finishBefore
      ? m.reschedule_ends({ day: fmtDay(dayOf(report.finish)), before: fmtDay(dayOf(report.finishBefore)) })
      : null,
    m.reschedule_peak({ hours: fmtHours(report.peakWeek) }),
    m.reschedule_moves({ count: report.moved }),
    m.reschedule_unplaced({ count: report.unplaced }),
    report.late ? m.reschedule_late({ count: report.late }) : null,
    report.overWeeks.length ? m.reschedule_over_weeks({ count: report.overWeeks.length }) : null,
  ].filter((part) => part !== null)
  return (
    <div className="grid gap-1.5" role="status" aria-busy={working}>
      <p className={`flex flex-wrap gap-x-1.5 text-[14px] text-ink ${working ? 'opacity-60' : ''}`}>
        {parts.map((part, i) => (
          <span key={part}>
            {i > 0 && <span className="mr-1.5 text-muted">·</span>}
            <span>{part}</span>
          </span>
        ))}
      </p>
      {working && <p className="text-[13px] text-muted">{m.reschedule_working()}</p>}
      {report.reasons.length > 0 && (
        <ul className="grid list-disc gap-0.5 pl-5 text-[13px]/[1.45] text-muted">
          {report.reasons.map((reason) => (
            <li key={JSON.stringify(reason)}>{reasonText(reason)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A binding fact of the re-balance in the person's language. */
function reasonText(reason: RebalanceReason): string {
  switch (reason.kind) {
    case 'nothing-to-move':
      return m.reschedule_reason_nothing_to_move()
    case 'full-weeks':
      return m.reschedule_reason_full_weeks({ from: fmtShort(dayOf(reason.from)), to: fmtShort(dayOf(reason.to)) })
    case 'days-off': {
      const shown = reason.days.slice(0, 6).map((day) => fmtShort(dayOf(day)))
      return m.reschedule_reason_days_off({ days: `${shown.join(', ')}${reason.days.length > 6 ? ', …' : ''}` })
    }
    case 'late':
      return m.reschedule_reason_late({
        placed: reason.placed,
        total: reason.total,
        deadline: fmtShort(dayOf(reason.deadline)),
      })
    case 'no-lab-block':
      return m.reschedule_reason_no_lab_block({ title: reason.title })
    case 'limit':
      return m.reschedule_reason_limit()
    case 'not-proven':
      return m.reschedule_reason_not_proven()
    default:
      return reason satisfies never
  }
}
