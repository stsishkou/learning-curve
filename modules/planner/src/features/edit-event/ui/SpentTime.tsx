import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { parseLocal, type PlanEvent } from '@lc/plan-domain'

const MINUTE = 60_000
const STEP = 15
const MOST = 12 * 60
/** The quick choices around the plan, in minutes from it */
const OFFSETS = [-15, 0, 15, 30, 60]
const KEY =
  'grid size-8 place-items-center rounded-lg border border-line bg-surface text-[15px] hover:bg-surface-2 disabled:opacity-40'
const CHIP =
  'rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px] tabular-nums hover:bg-surface-2 disabled:opacity-40'

interface Props {
  /** A session */
  event: PlanEvent
  /** The minutes logged; undefined while none are */
  spent: number | undefined
  disabled: boolean
  /** Called with the minutes the session really took */
  onLog: (minutes: number) => void
}

function offsetLabel(offset: number) {
  const time = fmtDuration(Math.abs(offset) * MINUTE)
  if (offset === 0) return { text: m.spent_as_planned(), name: m.spent_as_planned() }
  return offset > 0
    ? { text: `+${time}`, name: m.spent_over_plan({ time }) }
    : { text: `−${time}`, name: m.spent_under_plan({ time }) }
}

/**
 * How long a finished session really took: the pace and the forecast are built on it. Until a time is logged it says
 * so and offers choices around the plan, rather than show the plan as the time spent; a logged time steps by a quarter
 * hour.
 */
export function SpentTime({ event, spent, disabled, onLog }: Props) {
  const planned = Math.round((parseLocal(event.end) - parseLocal(event.start)) / MINUTE)
  const choices = OFFSETS.filter((offset) => planned + offset >= STEP && planned + offset <= MOST)
  return (
    <div className="mt-3.5 flex flex-col gap-2 text-[13px]" data-tip={m.spent_hint()}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-muted">{m.spent_label()}</span>
        {spent === undefined ? (
          <span className="font-semibold text-muted">{m.spent_not_logged()}</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              className={KEY}
              aria-label={m.spent_less()}
              data-tip={m.spent_less()}
              disabled={disabled || spent <= STEP}
              onClick={() => onLog(spent - STEP)}
            >
              −
            </button>
            <output className="min-w-[84px] text-center text-[14px] font-semibold tabular-nums">
              {fmtDuration(spent * MINUTE)}
            </output>
            <button
              type="button"
              className={KEY}
              aria-label={m.spent_more()}
              data-tip={m.spent_more()}
              disabled={disabled || spent >= MOST}
              onClick={() => onLog(spent + STEP)}
            >
              +
            </button>
          </span>
        )}
        <span className="text-muted">{m.spent_planned({ time: fmtDuration(planned * MINUTE) })}</span>
      </div>
      {spent === undefined && (
        <div className="flex flex-wrap gap-1.5">
          {choices.map((offset) => {
            const { text, name } = offsetLabel(offset)
            return (
              <button
                key={offset}
                type="button"
                className={CHIP}
                aria-label={name}
                disabled={disabled}
                onClick={() => onLog(planned + offset)}
              >
                {text}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
