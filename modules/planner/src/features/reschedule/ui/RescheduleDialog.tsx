import { fmtDay, fmtHours, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  addDays,
  currentRhythm,
  deadlineChange,
  deadlineOf,
  defaultStudyHours,
  movingSessions,
  nearestRhythm,
  parseLocal,
  previewUpdate,
  rebalanceChange,
  shiftTargets,
  type Plan,
  type PlanChange,
  type RebalanceReason,
  type RebalanceRequest,
  type RebalanceResult,
} from '@lc/plan-domain'
import { Button, FIELD, FOOT, INPUT, META, Modal, Segmented, TITLE } from '@lc/ui'
import { useId, useMemo, useState, type SubmitEvent } from 'react'

import { PlanDiffList, RuleWarningList } from '../../../shared/ui'
import { finishByRequest } from '../model/finish-by-request'
import { useRebalance, type Rebalance } from '../model/use-rebalance'
import { CalendarPicker } from './CalendarPicker'

interface Props {
  plan: Plan
  /** The first day to move, `YYYY-MM-DD`; null keeps the dialog closed */
  from: string | null
  /** Stores the changes in order, all or none. Rejects with the reason when they cannot be stored: the dialog shows it */
  onApply: (changes: PlanChange[]) => Promise<void>
  /** Works out a re-balance of one calendar; without it the dialog only moves */
  rebalance?: Rebalance | undefined
  /** What the dialog opens with, as a drag on the timeline asked */
  preset?: ReschedulePreset | undefined
  onClose: () => void
}

/** A calendar and a mode to open with: days to move by, or the day to finish by. Days are `YYYY-MM-DD`. */
export type ReschedulePreset =
  | { calendar: string; mode: 'move'; days?: number | undefined }
  | { calendar: string; mode: 'rebalance'; finishBy?: string | undefined }

type Mode = 'move' | 'rebalance'
/** What a re-balance follows: a rhythm, or a day to finish by */
type Aim = 'rhythm' | 'finish'

const RHYTHM_OPTIONS = [
  { key: '1/3', perDay: 1 / 3, label: () => m.reschedule_rhythm_1_3() },
  { key: '1/2', perDay: 1 / 2, label: () => m.reschedule_rhythm_1_2() },
  { key: '1', perDay: 1, label: () => m.reschedule_rhythm_1() },
  { key: '3/2', perDay: 3 / 2, label: () => m.reschedule_rhythm_3_2() },
  { key: '2', perDay: 2, label: () => m.reschedule_rhythm_2() },
  { key: '3', perDay: 3, label: () => m.reschedule_rhythm_3() },
] as const
type Rhythm = (typeof RHYTHM_OPTIONS)[number]['key']

const dayOf = (ymd: string) => parseLocal(`${ymd}T00:00`)

/** The offered rhythm nearest to how fast the course goes now, `1` when that is not known */
function rhythmNow(plan: Plan, calendar: string | undefined, from: string): Rhythm {
  const now = calendar ? currentRhythm(plan, calendar, from) : null
  const nearest = now === null ? 1 : nearestRhythm(now)
  return RHYTHM_OPTIONS.find((p) => p.perDay === nearest)?.key ?? '1'
}
const LABELS = {
  added: (count: number) => m.ai_added({ count }),
  removed: (count: number) => m.ai_removed({ count }),
  changed: (count: number) => m.reschedule_list({ count }),
}
const CHECK = 'flex items-center gap-2 text-[13.5px] text-ink'
const HINT = 'text-[12.5px] text-muted'

/**
 * Reschedules the open sessions from a day on: moves them by days and hours, in every calendar or in those picked, or
 * re-balances one calendar at a rhythm or towards its deadline, with the result worked out on the host and shown
 * before anything is stored.
 */
export function RescheduleDialog({ plan, from, onApply, rebalance, preset, onClose }: Props) {
  return (
    <Modal open={from !== null} size="wide" onClose={onClose}>
      {from !== null && (
        <RescheduleForm
          key={from}
          plan={plan}
          from={from}
          onApply={onApply}
          rebalance={rebalance}
          preset={preset}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

function RescheduleForm({ plan, from: initial, onApply, rebalance, preset, onClose }: Props & { from: string }) {
  const ids = useId()
  const [calendars, setCalendars] = useState<string[]>(preset ? [preset.calendar] : [])
  const [from, setFrom] = useState(initial)
  const [deadline, setDeadline] = useState(() => (preset ? (deadlineOf(plan, preset.calendar) ?? '') : ''))
  const [mode, setMode] = useState<Mode>(preset?.mode === 'rebalance' && rebalance ? 'rebalance' : 'move')
  const [days, setDays] = useState(preset?.mode === 'move' ? (preset.days ?? 7) : 7)
  const [hours, setHours] = useState(0)
  // From the course's own rhythm, so that each other choice reads as faster or slower than now.
  const [rhythm, setRhythm] = useState<Rhythm>(() => rhythmNow(plan, preset?.calendar, initial))
  // null follows the Deadline field, the day before it, or else the course's last session.
  const [finishBy, setFinishBy] = useState(preset?.mode === 'rebalance' ? (preset.finishBy ?? null) : null)
  const [aim, setAim] = useState<Aim>(
    preset?.mode === 'rebalance' && preset.finishBy !== undefined ? 'finish' : 'rhythm',
  )
  const [study, setStudy] = useState(() => defaultStudyHours(plan))
  const [overBudget, setOverBudget] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const rebalancing = mode === 'rebalance' && rebalance !== undefined
  // A deadline and a re-balance belong to one course.
  const [calendar = ''] = calendars.length === 1 ? calendars : []
  // A deadline on or before the first day cannot be aimed at: it is kept, but not sent.
  const due = deadline > from ? deadline : ''
  const lastDay = calendar ? (movingSessions(plan, { calendar, from }).at(-1)?.start.slice(0, 10) ?? '') : ''
  const finish = finishBy ?? (deadline ? addDays(deadline, -1) : lastDay)
  const finishable = finish !== '' && finish >= from
  const perDay = RHYTHM_OPTIONS.find((p) => p.key === rhythm)?.perDay ?? 1
  const known = calendar !== '' && currentRhythm(plan, calendar, from) !== null
  const nowLabel = known
    ? (RHYTHM_OPTIONS.find((p) => p.key === rhythmNow(plan, calendar, from))?.label() ?? null)
    : null
  const request = useMemo<RebalanceRequest | null>(() => {
    if (!rebalancing || !calendar || !from || study.from >= study.to) return null
    if (aim === 'rhythm') {
      return {
        calendar,
        from,
        deadline: due || undefined,
        target: { mode: 'rhythm', perDay },
        overBudget,
        hours: study,
      }
    }
    return finishable ? finishByRequest(plan, { calendar, from, finishBy: finish, overBudget, hours: study }) : null
  }, [plan, rebalancing, calendar, from, due, aim, finish, finishable, perDay, overBudget, study])
  const outcome = useRebalance(rebalance, plan, request)
  const { result } = outcome
  const moves = useMemo<PlanChange | null>(
    () => (result ? rebalanceChange(result, calendar) : null),
    [result, calendar],
  )

  const count = shiftTargets(plan, { calendars: calendars.length ? calendars : undefined, from }).length
  const deadlineStep = calendar ? deadlineChange(plan, calendar, deadline || null) : null
  const shift = useMemo<PlanChange>(
    () => ({
      type: 'events.shift',
      ...(calendars.length ? { calendars } : {}),
      from,
      ...(days ? { days } : {}),
      ...(hours ? { hours } : {}),
    }),
    [calendars, from, days, hours],
  )
  const shifting = count > 0 && (days !== 0 || hours !== 0)
  const step = rebalancing ? moves : shifting ? shift : null
  const preview = useMemo(() => (step ? previewUpdate(plan, [step]) : null), [plan, step])
  const warnings = preview?.warnings ?? []
  const moved = preview && preview.diff.changed.length > 0 && (
    <PlanDiffList diff={preview.diff} after={preview.after} before={plan} labels={LABELS} />
  )
  const ready = rebalancing
    ? request !== null && !outcome.working && result?.report.unplaced === 0 && (moves !== null || deadlineStep !== null)
    : shifting || deadlineStep !== null

  function chooseCalendars(next: string[]) {
    const [only] = next.length === 1 ? next : []
    setCalendars(next)
    setDeadline(only ? (deadlineOf(plan, only) ?? '') : '')
    setRhythm(rhythmNow(plan, only, from))
    setFinishBy(null)
  }

  function fill(byDays: number, byHours: number) {
    setDays(byDays)
    setHours(byHours)
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    const changes = [deadlineStep, rebalancing ? moves : shifting ? shift : null].filter((change) => change !== null)
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
      {/* Above the calendars: a re-balance takes one of them, a move takes several. */}
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
      <CalendarPicker calendars={plan.calendars} value={calendars} single={rebalancing} onChange={chooseCalendars} />
      <div className="grid items-start gap-3 md:grid-cols-2">
        <label className={FIELD}>
          {m.shift_from()}
          <input className={INPUT} type="date" value={from} required onChange={(e) => setFrom(e.target.value)} />
        </label>
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
            <p id={`${ids}-deadline`} className={HINT}>
              {m.reschedule_deadline_hint()}
            </p>
          </div>
        )}
      </div>
      {rebalancing ? (
        calendar ? (
          <>
            <div>
              <Segmented
                label={m.reschedule_aim()}
                value={aim}
                options={[
                  { value: 'rhythm', label: m.reschedule_rhythm() },
                  { value: 'finish', label: m.reschedule_finish_by() },
                ]}
                onChange={setAim}
              />
            </div>
            {aim === 'rhythm' ? (
              <div className="grid gap-1 text-[13px] text-muted">
                {nowLabel && <span>{m.reschedule_rhythm_now({ rhythm: nowLabel })}</span>}
                {/* On a narrow screen the rhythms scroll sideways rather than squeeze their labels onto several lines. */}
                <div className="-mx-1 overflow-x-auto px-1 pb-1">
                  <div className="w-max">
                    <Segmented
                      label={m.reschedule_rhythm()}
                      value={rhythm}
                      options={RHYTHM_OPTIONS.map((p) => ({ value: p.key, label: p.label() }))}
                      onChange={setRhythm}
                    />
                  </div>
                </div>
                <p className={HINT}>{m.reschedule_rhythm_hint()}</p>
              </div>
            ) : (
              <div className="grid gap-1">
                <label className={FIELD}>
                  {m.reschedule_finish_by()}
                  <input
                    className={`${INPUT} w-auto justify-self-start`}
                    type="date"
                    value={finish}
                    min={from}
                    aria-describedby={`${ids}-finish`}
                    onChange={(e) => setFinishBy(e.target.value || null)}
                  />
                </label>
                <p id={`${ids}-finish`} className={HINT}>
                  {m.reschedule_finish_hint()}
                </p>
              </div>
            )}
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
            {request && <Summary {...outcome} />}
            {moved}
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
            <Button onClick={() => fill(0, 1)}>{m.reschedule_hour_later()}</Button>
            <Button onClick={() => fill(0, -1)}>{m.reschedule_hour_earlier()}</Button>
            <Button onClick={() => fill(1, 0)}>{m.shift_day_later()}</Button>
            <Button onClick={() => fill(7, 0)}>{m.shift_week_later()}</Button>
            <Button onClick={() => fill(-7, 0)}>{m.shift_week_earlier()}</Button>
          </div>
          <p className="text-[13.5px] text-muted" role="status">
            {m.shift_count({ count })}
          </p>
          {moved}
          <RuleWarningList warnings={warnings} />
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
