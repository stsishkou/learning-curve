import { m } from '@lc/i18n/messages'
import { LABEL_MAX, LABELS_MAX, cleanLabel, sameLabel, type PlanCalendar } from '@lc/plan-domain'
import { Plus, Tag, X } from '@lc/ui'
import { useId, useRef, useState, type KeyboardEvent } from 'react'

export const LABEL_PILL =
  'inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-line bg-surface-2 py-px pl-1.5 text-[12.5px]'
const PILL_BUTTON =
  'grid size-6 flex-none place-items-center rounded-[5px] text-muted hover:bg-surface hover:text-ink focus-visible:text-ink'

interface Props {
  calendar: PlanCalendar
  /** Every label of the plan, offered while typing */
  known: string[]
  /** The field that adds a label is open; the dialog keeps one open at a time */
  adding: boolean
  onAdding: (open: boolean) => void
  /** Called with the calendar's whole new list */
  onChange: (labels: string[]) => Promise<void>
}

/** The labels of one calendar as pills that can be taken off, and a field that adds one, suggesting the known ones. */
export function CalendarLabels({ calendar, known, adding, onAdding, onChange }: Props) {
  const [text, setText] = useState('')
  // Set while the field closes, so the blur that comes with it does not add what was being dropped.
  const closing = useRef(false)
  const suggestions = useId()
  const own = calendar.labels ?? []
  const offered = known.filter((label) => !own.some((other) => sameLabel(other, label)))

  function add() {
    const label = cleanLabel(text)
    setText('')
    // A known label keeps its spelling, so a different case does not start a second one in the filter.
    const spelled = known.find((other) => sameLabel(other, label)) ?? label
    if (label && !own.some((other) => sameLabel(other, label))) void onChange([...own, spelled])
  }

  function close() {
    closing.current = true
    setText('')
    onAdding(false)
  }

  function keyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Escape') return
    // Closes the field, not the whole dialog.
    e.preventDefault()
    close()
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {own.map((label) => (
        <span key={label} className={LABEL_PILL}>
          <Tag size={12} aria-hidden className="flex-none text-muted" />
          <span className="truncate">{label}</span>
          <button
            type="button"
            className={PILL_BUTTON}
            aria-label={m.label_remove_from({ label, name: calendar.name })}
            data-tip={m.label_remove_from({ label, name: calendar.name })}
            onClick={() => void onChange(own.filter((other) => other !== label))}
          >
            <X size={13} aria-hidden />
          </button>
        </span>
      ))}
      {adding ? (
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault()
            if (cleanLabel(text)) add()
            else close()
          }}
        >
          <input
            className="h-7 w-44 min-w-0 rounded-md border border-line bg-surface px-2 text-[12.5px] outline-none focus-visible:border-focus"
            list={suggestions}
            aria-label={m.label_new({ name: calendar.name })}
            value={text}
            maxLength={LABEL_MAX}
            autoComplete="off"
            enterKeyHint="done"
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- the field replaces the button that was just pressed
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={keyDown}
            // The field stays open: closing it here would reflow the rows under it while a click on one of them
            // is still under way, and that click would miss.
            onBlur={() => {
              if (!closing.current) add()
            }}
          />
          <datalist id={suggestions}>
            {offered.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </datalist>
        </form>
      ) : (
        own.length < LABELS_MAX && (
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-line px-2 text-[12.5px] text-muted hover:text-ink focus-visible:text-ink"
            aria-label={m.label_add_to({ name: calendar.name })}
            data-tip={m.label_add_to({ name: calendar.name })}
            onClick={() => {
              closing.current = false
              onAdding(true)
            }}
          >
            <Plus size={13} aria-hidden />
            {m.label_add()}
          </button>
        )
      )}
    </div>
  )
}
