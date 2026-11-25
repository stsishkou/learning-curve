import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'

const MINUTE = 60_000
/** The quick choices around the plan, in minutes from it */
const OFFSETS = [-15, 0, 15, 30, 60]
const LEAST = 15
const MOST = 12 * 60
const CHIP =
  'rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px] tabular-nums hover:bg-surface-2 disabled:opacity-40 aria-pressed:border-focus aria-pressed:bg-surface-2'

interface Props {
  /** The session's planned minutes: the choices sit around them */
  planned: number
  /** The minutes chosen, shown pressed; undefined while none is */
  chosen?: number | undefined
  disabled?: boolean
  onChoose: (minutes: number) => void
}

function labelOf(offset: number) {
  const time = fmtDuration(Math.abs(offset) * MINUTE)
  if (offset === 0) return { text: m.spent_as_planned(), name: m.spent_as_planned() }
  return offset > 0
    ? { text: `+${time}`, name: m.spent_over_plan({ time }) }
    : { text: `−${time}`, name: m.spent_under_plan({ time }) }
}

/** One-click times for a finished session, around its plan: 15 minutes less, as planned, and up to an hour more. */
export function TimeChoices({ planned, chosen, disabled = false, onChoose }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {OFFSETS.filter((offset) => planned + offset >= LEAST && planned + offset <= MOST).map((offset) => {
        const { text, name } = labelOf(offset)
        return (
          <button
            key={offset}
            type="button"
            className={CHIP}
            aria-label={name}
            aria-pressed={chosen === undefined ? undefined : chosen === planned + offset}
            disabled={disabled}
            onClick={() => onChoose(planned + offset)}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}
