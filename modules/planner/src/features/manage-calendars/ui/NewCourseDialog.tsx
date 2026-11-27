import { dowShort, fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  DAY,
  LABEL_MAX,
  cleanLabel,
  moduleHours,
  nowMinsk,
  parseLocal,
  parseModules,
  planCourse,
  planLabels,
  sameLabel,
  ymd,
  type CourseInput,
  type CourseModule,
  type CoursePlan,
  type NewSession,
  type Plan,
  type PlanChange,
} from '@lc/plan-domain'
import { previewUpdate, type UpdatePreview } from '@lc/plan-domain/protocol'
import { defaultStudyHours } from '@lc/plan-domain/rebalance'
import { Button, FIELD, FOOT, INPUT, META, Modal, TITLE, TriangleAlert } from '@lc/ui'
import { useDeferredValue, useId, useMemo, useState, type SubmitEvent } from 'react'

import { RuleWarningList } from '../../../shared/ui'
import { freeColor } from '../model/palette'

interface Props {
  /** The whole plan, hidden calendars included: their sessions are still planned, so the course keeps clear of them */
  plan: Plan
  /** Minsk wall-clock ms; null before the clock is known */
  now: number | null
  open: boolean
  /** Stores the changes in order, rejecting with the reason */
  onApply: (changes: PlanChange[]) => Promise<void>
  /** After the course is stored, with the start of its first session */
  onAdded?: ((start: string) => void) | undefined
  onClose: () => void
}

// Shown only once the person has left a field with a wrong value or submitted it.
const CHECKED = `${INPUT} user-invalid:border-today`
const CHIP =
  'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-line-soft px-3 text-[13px] text-muted tabular-nums hover:text-ink has-checked:border-focus has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus'
const WARN = 'flex items-start gap-2 text-[13px]/[1.45] text-today-ink'
// Monday first, as the week grid shows it; the numbers are `weekday()`'s, 0 Sunday … 6 Saturday.
const WEEK: readonly number[] = [1, 2, 3, 4, 5, 6, 0]
const WORKDAYS: readonly number[] = [1, 2, 3, 4, 5]
const PER_DAY: readonly number[] = [1, 2, 3]
const A_MONDAY = parseLocal('2026-11-30T00:00')
const dayName = (weekday: number) => dowShort(A_MONDAY + ((weekday + 6) % 7) * DAY)
const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/
const TIME_FORMAT = /^\d{2}:\d{2}$/

interface Outcome extends CoursePlan {
  sessions: NewSession[]
  preview: UpdatePreview
}

/** A whole course from its pasted module list: its sessions placed in free time, shown before anything is added. */
export function NewCourseDialog({ open, now, ...form }: Props) {
  return (
    <Modal open={open} size="wide" onClose={form.onClose}>
      {open && <CourseForm now={now ?? nowMinsk()} {...form} />}
    </Modal>
  )
}

function CourseForm({ plan, now, onApply, onAdded, onClose }: Omit<Props, 'open' | 'now'> & { now: number }) {
  const ids = useId()
  const known = useMemo<string[]>(() => planLabels(plan).map((label) => label.name), [plan])
  const [name, setName] = useState('')
  const [short, setShort] = useState('')
  const [color, setColor] = useState(() => freeColor(plan))
  const [picked, setPicked] = useState<string[]>([])
  const [another, setAnother] = useState('')
  const [link, setLink] = useState('')
  const [text, setText] = useState('')
  const [firstDay, setFirstDay] = useState(() => ymd(now + DAY))
  const [weekdays, setWeekdays] = useState<readonly number[]>(WORKDAYS)
  const [start, setStart] = useState(() => defaultStudyHours(plan).from)
  const [perDay, setPerDay] = useState(1)
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const modules = useMemo<CourseModule[]>(() => parseModules(text), [text])
  const taken = plan.calendars.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())
  const input = useMemo<CourseInput>(() => {
    const extra = cleanLabel(another)
    // A known label keeps its spelling, so a different case does not start a second one in the filter.
    const typed =
      extra && !picked.some((label) => sameLabel(label, extra)) ? [known.find((k) => sameLabel(k, extra)) ?? extra] : []
    return {
      name,
      short,
      color,
      labels: [...picked, ...typed],
      link,
      modules,
      firstDay,
      weekdays: [...weekdays],
      start,
      perDay,
      deadline: DAY_FORMAT.test(deadline) ? deadline : null,
    }
  }, [name, short, color, picked, another, known, link, modules, firstDay, weekdays, start, perDay, deadline])
  // Typing in the module list stays quick: the sessions are placed again once the typing pauses.
  const shown = useDeferredValue(input)
  const outcome = useMemo<Outcome | null>(() => {
    if (!shown.name.trim() || !shown.modules.length) return null
    if (!DAY_FORMAT.test(shown.firstDay) || !TIME_FORMAT.test(shown.start)) return null
    const course = planCourse(plan, shown, now)
    return {
      ...course,
      sessions: course.change.sessions.filter((s) => s.kind !== 'milestone'),
      preview: previewUpdate(plan, [course.change], now),
    }
  }, [plan, shown, now])
  const hours = modules.reduce((sum, module) => sum + moduleHours(module), 0)
  const labs = modules.filter((module) => module.lab).length
  const unknown = modules.filter((module) => !module.lab && module.minutes === null).length
  const ready = outcome !== null && outcome.sessions.length > 0 && outcome.preview.problem === null && !taken && !busy

  function toggleDay(day: number) {
    setWeekdays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]))
  }

  function toggleLabel(label: string) {
    setPicked((labels) => (labels.includes(label) ? labels.filter((l) => l !== label) : [...labels, label]))
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    if (taken || !weekdays.length) return
    const { change } = planCourse(plan, input, now)
    const first = change.sessions.find((s) => s.kind !== 'milestone')
    if (!first) return
    setBusy(true)
    try {
      await onApply([change])
      onAdded?.(first.start)
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
          {m.new_course()}
        </h3>
        <p className={META}>{m.course_hint()}</p>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className={FIELD}>
          <label htmlFor={`${ids}-name`}>{m.course_name()}</label>
          <div className="flex gap-2">
            <input
              type="color"
              className="size-[42px] flex-none cursor-pointer rounded-lg border border-line bg-surface-2 p-1"
              aria-label={m.field_color()}
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <input
              id={`${ids}-name`}
              name="name"
              className={`${CHECKED} min-w-0 flex-1`}
              required
              autoComplete="off"
              enterKeyHint="next"
              value={name}
              aria-invalid={taken}
              aria-describedby={taken ? `${ids}-taken` : undefined}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {taken && (
            <p id={`${ids}-taken`} className="text-today-ink">
              {m.course_name_taken()}
            </p>
          )}
        </div>
        <div className={FIELD}>
          <label htmlFor={`${ids}-short`}>{m.course_short()}</label>
          <input
            id={`${ids}-short`}
            name="short"
            className={INPUT}
            autoComplete="off"
            enterKeyHint="next"
            placeholder={name.trim() || undefined}
            value={short}
            aria-describedby={`${ids}-short-hint`}
            onChange={(e) => setShort(e.target.value)}
          />
          <p id={`${ids}-short-hint`}>{m.course_short_hint({ short: short.trim() || name.trim() || '…' })}</p>
        </div>
        <div className={FIELD}>
          <label htmlFor={`${ids}-link`}>{m.course_link()}</label>
          <input
            id={`${ids}-link`}
            name="link"
            type="url"
            inputMode="url"
            className={CHECKED}
            autoComplete="off"
            enterKeyHint="next"
            placeholder="https://"
            value={link}
            aria-describedby={`${ids}-link-hint`}
            onChange={(e) => setLink(e.target.value)}
          />
          <p id={`${ids}-link-hint`}>{m.course_link_hint()}</p>
        </div>
        <fieldset className={FIELD}>
          <legend className="mb-1">{m.labels()}</legend>
          <div className="flex flex-wrap items-center gap-1.5">
            {known.map((label) => (
              <label key={label} className={CHIP}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={picked.includes(label)}
                  onChange={() => toggleLabel(label)}
                />
                {label}
              </label>
            ))}
            <input
              className="h-8 w-40 min-w-0 rounded-full border border-dashed border-line bg-surface px-3 text-[13px] text-ink outline-none focus-visible:border-focus"
              aria-label={m.course_new_label()}
              placeholder={m.course_new_label()}
              maxLength={LABEL_MAX}
              autoComplete="off"
              enterKeyHint="next"
              value={another}
              onChange={(e) => setAnother(e.target.value)}
            />
          </div>
        </fieldset>
      </div>

      <div className={FIELD}>
        <label htmlFor={`${ids}-modules`}>{m.course_modules()}</label>
        <textarea
          id={`${ids}-modules`}
          name="modules"
          // Grows with the pasted list up to a point, then scrolls; a fixed height where `field-sizing` is unknown.
          className={`${CHECKED} field-sizing-content max-h-[16lh] min-h-[6lh] w-full resize-y text-[14px]/[1.45]`}
          required
          rows={6}
          spellCheck={false}
          placeholder={m.course_modules_placeholder()}
          value={text}
          aria-describedby={`${ids}-modules-hint ${ids}-modules-parsed`}
          onChange={(e) => setText(e.target.value)}
        />
        <p id={`${ids}-modules-hint`}>{m.course_modules_hint()}</p>
        <p id={`${ids}-modules-parsed`} className="text-ink tabular-nums">
          {modules.length > 0 &&
            [
              `${m.course_modules_count({ count: modules.length })}, ${fmtHours(hours)}`,
              labs ? m.course_labs({ count: labs }) : '',
              unknown ? m.course_unknown({ count: unknown }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
        </p>
      </div>

      <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-4">
        <div className={FIELD}>
          <label htmlFor={`${ids}-first`}>{m.course_first_day()}</label>
          <input
            id={`${ids}-first`}
            name="firstDay"
            type="date"
            className={CHECKED}
            required
            min={ymd(now)}
            value={firstDay}
            onChange={(e) => setFirstDay(e.target.value)}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor={`${ids}-start`}>{m.course_start()}</label>
          <input
            id={`${ids}-start`}
            name="start"
            type="time"
            className={CHECKED}
            required
            step={1800}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor={`${ids}-deadline`}>{m.course_deadline()}</label>
          <input
            id={`${ids}-deadline`}
            name="deadline"
            type="date"
            className={CHECKED}
            min={firstDay}
            value={deadline}
            aria-describedby={`${ids}-deadline-hint`}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <p id={`${ids}-deadline-hint`}>{m.course_deadline_hint()}</p>
        </div>
        <fieldset className={FIELD}>
          <legend className="mb-1">{m.course_per_day()}</legend>
          <div className="flex flex-wrap gap-1.5">
            {PER_DAY.map((count) => (
              <label key={count} className={CHIP}>
                <input
                  type="radio"
                  name="perDay"
                  className="sr-only"
                  value={count}
                  checked={perDay === count}
                  onChange={() => setPerDay(count)}
                />
                {count}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset className={FIELD} aria-describedby={weekdays.length ? undefined : `${ids}-no-days`}>
        <legend className="mb-1">{m.course_days()}</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEK.map((day) => (
            <label key={day} className={CHIP}>
              <input
                type="checkbox"
                className="sr-only"
                checked={weekdays.includes(day)}
                onChange={() => toggleDay(day)}
              />
              {dayName(day)}
            </label>
          ))}
        </div>
        {!weekdays.length && (
          <p id={`${ids}-no-days`} className="text-today-ink">
            {m.course_no_days()}
          </p>
        )}
      </fieldset>

      <section aria-labelledby={`${ids}-preview`} className="grid gap-2.5 rounded-xl border border-line-soft p-3.5">
        <h4 id={`${ids}-preview`} className="text-[13px] font-semibold">
          {m.course_preview()}
        </h4>
        {outcome === null ? (
          <p className="text-[13px] text-muted">{m.course_empty()}</p>
        ) : (
          <CoursePreview outcome={outcome} plan={plan} input={shown} />
        )}
      </section>

      {error && (
        <p className="text-[13px] text-today-ink" role="alert">
          {error}
        </p>
      )}
      <div className={FOOT}>
        <Button type="button" onClick={onClose}>
          {m.cancel()}
        </Button>
        <Button primary type="submit" disabled={!ready}>
          {m.course_add()}
        </Button>
      </div>
    </form>
  )
}

function CoursePreview({ outcome, plan, input }: { outcome: Outcome; plan: Plan; input: CourseInput }) {
  const { sessions, preview, unplaced } = outcome
  const first = sessions.at(0)
  const last = sessions.at(-1)
  const hours = sessions.reduce((sum, s) => sum + (parseLocal(s.end) - parseLocal(s.start)) / 3_600_000, 0)
  // Every session past the deadline breaks the same rule: one line says it, not one a session.
  const late = preview.warnings.filter((w) => w.rule === 'deadline').length
  const warnings = preview.warnings.filter((w) => w.rule !== 'deadline')
  const waited = first !== undefined && parseLocal(first.start) >= parseLocal(`${input.firstDay}T00:00`) + 7 * DAY
  return (
    <>
      {first && last && (
        <p className="text-[13.5px] tabular-nums">
          {m.course_sessions({ count: sessions.length })} · {fmtHours(hours)} · {fmtDay(parseLocal(first.start))} –{' '}
          {fmtDay(parseLocal(last.start))}
        </p>
      )}
      {waited && (
        <p className="text-[13px]/[1.45] text-muted">
          {m.course_starts_late({ day: fmtDay(parseLocal(first.start)) })}
        </p>
      )}
      {late > 0 && input.deadline && (
        <p className={WARN}>
          <TriangleAlert size={15} aria-hidden className="mt-0.5 flex-none" />
          {m.course_after_deadline({ count: late, day: fmtDay(parseLocal(`${input.deadline}T00:00`)) })}
        </p>
      )}
      {unplaced > 0 && (
        <p className={WARN}>
          <TriangleAlert size={15} aria-hidden className="mt-0.5 flex-none" />
          {m.course_unplaced({ count: unplaced })}
        </p>
      )}
      {preview.problem && (
        <p className={WARN}>
          <TriangleAlert size={15} aria-hidden className="mt-0.5 flex-none" />
          {preview.problem.message}
        </p>
      )}
      {preview.overBudget.length > 0 && (
        <p className={WARN}>
          <TriangleAlert size={15} aria-hidden className="mt-0.5 flex-none" />
          {m.ai_over_budget({
            budget: fmtHours(plan.meta.weeklyBudgetHours),
            weeks: preview.overBudget
              .map((w) => `${fmtDay(parseLocal(`${w.week}T00:00`))} (${fmtHours(w.hours)})`)
              .join(', '),
          })}
        </p>
      )}
      <RuleWarningList warnings={warnings} />
      {sessions.length > 0 && (
        <ol className="sm:grid-cols-[auto_auto_minmax(0,1fr)] sm:gap-x-3 sm:gap-y-1 grid max-h-72 gap-y-1.5 overflow-y-auto text-[13px] tabular-nums">
          {sessions.map((s) => (
            <li
              key={s.start}
              className="sm:col-span-3 sm:grid sm:grid-cols-subgrid flex flex-wrap items-baseline gap-x-2"
            >
              <span className="whitespace-nowrap text-muted">{fmtDay(parseLocal(s.start))}</span>
              <span className="whitespace-nowrap text-muted">
                {s.start.slice(11)}–{s.end.slice(11)}
              </span>
              <span className="sm:w-auto w-full min-w-0 break-words">
                {s.title}
                {s.kind === 'lab' && (
                  <em className="ml-1.5 rounded-md bg-surface-2 px-1.5 py-px text-[12px] text-muted not-italic">
                    {m.course_lab()}
                  </em>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
