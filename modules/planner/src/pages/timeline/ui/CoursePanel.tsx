import { fmtDay, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { addDays, laneSpare, parseLocal, type CalendarLane, type LaneChange, type RuleWarning } from '@lc/plan-domain'
import { Button, calendarColor, Dot, FIELD, INPUT, X } from '@lc/ui'

import { RuleWarningList } from '../../../shared/ui'
import type { CourseEdit } from '../model/use-timeline-draft'

interface Props {
  /** The picked course as the plan has it; null when none is picked */
  lane: CalendarLane | null
  /** How the draft changes it */
  change?: LaneChange | undefined
  /** What the draft asks of it */
  edit?: CourseEdit | undefined
  /** Rules of the plan the draft breaks in this course */
  warnings: RuleWarning[]
  /** Its re-balance is being worked out */
  working: boolean
  /** Why its changes could not be worked out */
  failed?: string | undefined
  /** `YYYY-MM-DD`; finish days before it cannot be picked */
  today: string | null
  /** Changes what the draft asks of the course; null takes it out of the draft. Without it the panel only shows */
  onEdit?: ((patch: CourseEdit | null) => void) | undefined
  /** How far the whole move may go, in days; null when nothing is left to move */
  bounds: { min: number; max: number } | null
  /** Present when the host can re-balance: the finish-by controls show */
  canRebalance: boolean
  /** Opens Reschedule for the course, with every option it has */
  onMore?: (() => void) | undefined
  /** Present where the panel can be put away: the course is no longer picked */
  onClose?: (() => void) | undefined
}

const day = (ymd: string) => parseLocal(`${ymd}T00:00`)
const datesOf = (lane: CalendarLane) =>
  m.timeline_dates({ from: fmtShort(day(lane.first)), to: fmtShort(day(lane.last)) })
const deadlineText = (lane: CalendarLane) =>
  lane.deadline === null ? m.timeline_no_deadline() : fmtDay(day(lane.deadline))

function spareOf(lane: CalendarLane): string {
  const spare = laneSpare(lane)
  if (spare === null) return '—'
  return spare < 0 ? m.timeline_late({ days: -spare }) : m.timeline_spare({ days: spare })
}

const weeksText = (days: number) => {
  const weeks = days / 7
  return m.timeline_shift_weeks({ weeks: weeks > 0 ? `+${weeks}` : `−${-weeks}` })
}

interface FactProps {
  label: string
  now: string
  /** Shown only while the draft changes the course */
  draft?: string | undefined
}

function Fact({ label, now, draft }: FactProps) {
  return (
    <tr className="border-t border-line-soft">
      <th scope="row" className="py-1.5 pr-2 text-left font-normal text-muted">
        {label}
      </th>
      <td className="py-1.5 pr-2 whitespace-nowrap">{now}</td>
      {draft !== undefined && (
        <td className={`py-1.5 whitespace-nowrap ${draft === now ? 'text-muted' : 'font-semibold text-focus'}`}>
          {draft}
        </td>
      )}
    </tr>
  )
}

/** The picked course: its dates, deadline and spare days now and in the draft, and the ways to change them. */
export function CoursePanel(props: Props) {
  const { lane, change, edit, warnings, working, failed, today, bounds, onEdit, canRebalance, onMore, onClose } = props
  if (!lane) {
    return (
      <section aria-label={m.timeline_course()} className="rounded-2xl border border-line bg-surface p-4 md:p-5">
        <p className="text-[13.5px]/[1.5] text-muted">{m.timeline_pick()}</p>
      </section>
    )
  }
  const after = change?.after
  const deadline = edit?.deadline ?? lane.deadline
  const move = edit?.move ?? 0
  return (
    <section
      aria-label={m.timeline_course()}
      className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border border-line bg-surface p-4 md:p-5"
      style={calendarColor(lane.calendar.color)}
    >
      <div className="flex items-start gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-[16px]/[1.3] font-semibold">
          <Dot className="size-2.5 flex-none" />
          <span className="min-w-0">{lane.calendar.name}</span>
        </h2>
        {onClose && (
          <button
            type="button"
            className="-mt-1 -mr-1 ml-auto grid size-7 flex-none place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
            aria-label={m.close()}
            data-tip={m.close()}
            onClick={onClose}
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>
      <table className="w-full text-[13px] tabular-nums">
        <thead>
          <tr className="text-[12px] text-muted">
            <td aria-hidden />
            <th scope="col" className="pb-1 text-left font-medium">
              {m.timeline_now()}
            </th>
            {after && (
              <th scope="col" className="pb-1 text-left font-medium text-focus">
                {m.timeline_draft()}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          <Fact label={m.timeline_row_dates()} now={datesOf(lane)} draft={after && datesOf(after)} />
          <Fact label={m.reschedule_deadline()} now={deadlineText(lane)} draft={after && deadlineText(after)} />
          <Fact label={m.timeline_row_spare()} now={spareOf(lane)} draft={after && spareOf(after)} />
          {change && <Fact label={m.timeline_row_moved()} now="0" draft={String(change.moved)} />}
        </tbody>
      </table>
      {working && (
        <p className="text-[13px] text-muted" role="status">
          {m.reschedule_working()}
        </p>
      )}
      {failed !== undefined && (
        <p className="text-[13px] text-today-ink" role="alert">
          {m.reschedule_failed({ reason: failed })}
        </p>
      )}
      {onEdit && (
        <div className="grid gap-3 border-t border-line-soft pt-3 text-[13.5px]">
          <div className="grid gap-1.5">
            <span className="text-[13px] text-muted">
              {m.timeline_move_by()}
              {move ? ` · ${weeksText(move)}` : ''}
            </span>
            <div className="flex flex-wrap gap-2 *:flex-1">
              <Button disabled={!bounds || move - 7 < bounds.min} onClick={() => onEdit({ move: move - 7 })}>
                {m.timeline_earlier_week()}
              </Button>
              <Button disabled={!bounds || move + 7 > bounds.max} onClick={() => onEdit({ move: move + 7 })}>
                {m.timeline_later_week()}
              </Button>
            </div>
          </div>
          {canRebalance && (
            <div className="grid gap-1.5">
              <label className={FIELD}>
                {m.reschedule_finish_by()}
                <input
                  type="date"
                  className={INPUT}
                  value={edit?.finishBy ?? ''}
                  min={today ?? undefined}
                  onChange={(e) => onEdit({ finishBy: e.target.value || undefined })}
                />
              </label>
              {deadline !== null && (
                <Button onClick={() => onEdit({ finishBy: addDays(deadline, -1) })}>
                  {m.timeline_finish_by_deadline()}
                </Button>
              )}
            </div>
          )}
          <label className={FIELD}>
            {m.reschedule_deadline()}
            <input
              type="date"
              className={INPUT}
              value={deadline ?? ''}
              onChange={(e) => {
                const picked = e.target.value
                onEdit({ deadline: picked && picked !== lane.deadline ? picked : undefined })
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2 *:flex-1">
            {edit && <Button onClick={() => onEdit(null)}>{m.timeline_reset_course()}</Button>}
            {onMore && <Button onClick={onMore}>{m.timeline_more()}</Button>}
          </div>
        </div>
      )}
      {/* After the controls: a long list of clashes would push them out of sight. */}
      <RuleWarningList warnings={warnings} />
    </section>
  )
}
