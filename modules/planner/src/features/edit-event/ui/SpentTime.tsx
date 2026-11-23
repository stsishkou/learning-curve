import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { parseLocal, type PlanEvent } from '@lc/plan-domain'

const MINUTE = 60_000
const STEP = 15
const KEY =
  'grid size-8 place-items-center rounded-lg border border-line bg-surface text-[15px] hover:bg-surface-2 disabled:opacity-40'

interface Props {
  /** A session that is marked done */
  event: PlanEvent
  disabled: boolean
  /** Called with the minutes the session really took */
  onLog: (minutes: number) => void
}

/** How long a finished session really took, in quarter-hour steps: the pace and the forecast are built on it. */
export function SpentTime({ event, disabled, onLog }: Props) {
  const planned = Math.round((parseLocal(event.end) - parseLocal(event.start)) / MINUTE)
  const spent = event.actual ?? planned
  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]" data-tip={m.spent_hint()}>
      <span className="text-muted">{m.spent_label()}</span>
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
          disabled={disabled || spent >= 12 * 60}
          onClick={() => onLog(spent + STEP)}
        >
          +
        </button>
      </span>
      <span className="text-muted">{m.spent_planned({ time: fmtDuration(planned * MINUTE) })}</span>
    </div>
  )
}
