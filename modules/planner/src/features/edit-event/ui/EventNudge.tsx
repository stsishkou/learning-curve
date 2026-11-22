import { m } from '@lc/i18n/messages'
import {
  DAY,
  HOUR,
  movePatch,
  parseLocal,
  startOfDay,
  weekday,
  weekdaysOf,
  ymd,
  type EventPatch,
  type PlanEvent,
} from '@lc/plan-domain'

const STEP = HOUR / 2
const KEY =
  'grid h-8 min-w-8 place-items-center rounded-lg border border-line bg-surface px-2 text-[13px] hover:bg-surface-2 disabled:opacity-40'

interface Props {
  event: PlanEvent
  /** For a repeating event: the day of the repeat that was opened, `YYYY-MM-DD` */
  day: string | null
  disabled: boolean
  /** Called with the patch and the day the opened repeat lands on */
  onMove: (patch: EventPatch, day: string) => void
}

/** Moves and resizes the event in half-hour and one-day steps: the way to do it without a mouse. */
export function EventNudge({ event, day, disabled, onMove }: Props) {
  const length = parseLocal(event.end) - parseLocal(event.start)
  const from = event.rrule && day ? parseLocal(`${day}T${event.start.slice(11, 16)}`) : parseLocal(event.start)
  // Without the day of a repeat there is no telling which weekday of the series to move.
  const canChangeDay = !event.rrule || day !== null

  /** A series steps over the weekdays it already repeats on: landing on one would merge the two repeats. */
  function dayStep(direction: 1 | -1) {
    const taken = new Set(event.rrule ? weekdaysOf(event.rrule) : [])
    let shift = direction * DAY
    while (taken.has(weekday(from + shift)) && Math.abs(shift) < 7 * DAY) shift += direction * DAY
    nudge(shift)
  }

  function nudge(shift: number, grow = 0) {
    const s = from + shift
    const e = s + length + grow
    const sameDay = event.allDay || shift % DAY === 0 || startOfDay(e - 1) === startOfDay(from)
    if (e - s < STEP || !sameDay || (shift % DAY !== 0 && startOfDay(s) !== startOfDay(from))) return
    onMove(movePatch(event, from, s, e), ymd(s))
  }

  const key = (label: string, sign: string, run: () => void, off = false) => (
    <button type="button" className={KEY} aria-label={label} title={label} disabled={disabled || off} onClick={run}>
      {sign}
    </button>
  )

  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-muted">
      <span className="flex items-center gap-1.5">
        {m.nudge_day()}
        {key(m.nudge_day_back(), '‹', () => dayStep(-1), !canChangeDay)}
        {key(m.nudge_day_forward(), '›', () => dayStep(1), !canChangeDay)}
      </span>
      {!event.allDay && (
        <>
          <span className="flex items-center gap-1.5">
            {m.nudge_time()}
            {key(m.nudge_earlier(), '↑', () => nudge(-STEP))}
            {key(m.nudge_later(), '↓', () => nudge(STEP))}
          </span>
          <span className="flex items-center gap-1.5">
            {m.nudge_length()}
            {key(m.nudge_shorter(), '−', () => nudge(0, -STEP))}
            {key(m.nudge_longer(), '+', () => nudge(0, STEP))}
          </span>
        </>
      )}
    </div>
  )
}
