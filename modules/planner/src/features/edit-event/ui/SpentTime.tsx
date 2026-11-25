import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { parseLocal, type PlanEvent } from '@lc/plan-domain'

import { TimeChoices } from '../../../shared/ui'

const MINUTE = 60_000
const STEP = 15
const MOST = 12 * 60
const KEY =
  'grid size-8 place-items-center rounded-lg border border-line bg-surface text-[15px] hover:bg-surface-2 disabled:opacity-40'

interface Props {
  /** A session */
  event: PlanEvent
  /** The minutes logged; undefined while none are */
  spent: number | undefined
  /** The session is being marked done: the field asks for its time */
  asking?: boolean
  disabled: boolean
  /** Called with the minutes the session really took */
  onLog: (minutes: number) => void
}

/**
 * How long a finished session really took: the pace and the forecast are built on it. Until a time is logged it says
 * so and offers choices around the plan, rather than show the plan as the time spent; a logged time steps by a quarter
 * hour.
 */
export function SpentTime({ event, spent, asking = false, disabled, onLog }: Props) {
  const planned = Math.round((parseLocal(event.end) - parseLocal(event.start)) / MINUTE)
  return (
    <div className="mt-3.5 flex flex-col gap-2 text-[13px]" data-tip={m.spent_hint()}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={asking ? 'font-semibold' : 'text-muted'}>{asking ? m.spent_ask() : m.spent_label()}</span>
        {asking ? null : spent === undefined ? (
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
      {spent === undefined && <TimeChoices planned={planned} disabled={disabled} onChoose={onLog} />}
    </div>
  )
}
