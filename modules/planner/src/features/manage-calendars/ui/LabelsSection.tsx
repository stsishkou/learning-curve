import { m } from '@lc/i18n/messages'
import { LABEL_MAX, cleanLabel, planLabels, type Plan, type PlanChange, type PlanLabel } from '@lc/plan-domain'
import { Button, Eye, EyeOff, INPUT, Pencil, Tag, Trash2 } from '@lc/ui'
import { useId, useState, type KeyboardEvent } from 'react'

interface Props {
  /** The whole plan, hidden calendars included */
  plan: Plan
  onChange: (change: PlanChange) => Promise<void>
}

/** Every label of the plan with its calendars: rename it, take it off all of them, or hide or show them together. */
export function LabelsSection({ plan, onChange }: Props) {
  const heading = useId()
  const labels = planLabels(plan)
  if (!labels.length) return null
  const shown = plan.calendars.filter((c) => !c.hidden).map((c) => c.id)
  return (
    <section className="mt-4" aria-labelledby={heading}>
      <h4 id={heading} className="mb-0.5 text-[13px] font-semibold text-muted">
        {m.labels()}
      </h4>
      <p className="mb-2 text-[12.5px] text-muted">{m.labels_hint()}</p>
      <ul className="grid gap-1">
        {labels.map((label) => (
          <LabelRow
            // Remounts on a rename, so the field starts from the new name.
            key={label.name}
            plan={plan}
            label={label}
            // Hiding them all would leave nothing on screen: the last shown calendar stays.
            canHide={shown.some((id) => !label.calendars.includes(id))}
            onChange={onChange}
          />
        ))}
      </ul>
    </section>
  )
}

interface RowProps {
  plan: Plan
  label: PlanLabel
  canHide: boolean
  onChange: (change: PlanChange) => Promise<void>
}

function LabelRow({ plan, label, canHide, onChange }: RowProps) {
  const [renaming, setRenaming] = useState(false)
  const [text, setText] = useState(label.name)
  const calendars = plan.calendars.filter((c) => label.calendars.includes(c.id))
  const allHidden = calendars.every((c) => c.hidden)
  const names = calendars.map((c) => c.name).join(', ')

  function rename() {
    const to = cleanLabel(text)
    setRenaming(false)
    if (to && to !== label.name) void onChange({ type: 'label.rename', from: label.name, to })
    else setText(label.name)
  }

  function keyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Escape') return
    e.preventDefault()
    setText(label.name)
    setRenaming(false)
  }

  return (
    <li className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-surface-2">
      <Tag size={14} aria-hidden className="flex-none text-muted" />
      {renaming ? (
        <form
          className="flex min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            rename()
          }}
        >
          <input
            className={`${INPUT} min-w-0 flex-1 py-1`}
            aria-label={m.label_name({ label: label.name })}
            value={text}
            maxLength={LABEL_MAX}
            autoComplete="off"
            enterKeyHint="done"
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- the field replaces the name that was just clicked
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={keyDown}
            onBlur={rename}
          />
        </form>
      ) : (
        <span className={`min-w-0 flex-1 truncate text-[14px] font-medium ${allHidden ? 'text-muted' : ''}`}>
          {label.name}
        </span>
      )}
      <span className="flex flex-none items-center gap-1.5 text-[12.5px] text-muted tabular-nums" data-tip={names}>
        <span className="flex -space-x-1" aria-hidden>
          {calendars.slice(0, 5).map((c) => (
            <i key={c.id} className="size-2.5 rounded-full ring-2 ring-surface" style={{ background: c.color }} />
          ))}
        </span>
        <span className="hidden md:inline">{m.calendars_count({ count: calendars.length })}</span>
        <span className="sr-only">{names}</span>
      </span>
      <Button
        className="grid place-items-center px-2.5"
        aria-label={m.label_rename({ label: label.name })}
        data-tip={m.label_rename({ label: label.name })}
        onClick={() => setRenaming(true)}
      >
        <Pencil size={14} aria-hidden />
      </Button>
      {(allHidden || canHide) && (
        <Button
          className="grid place-items-center px-2.5"
          aria-label={allHidden ? m.label_show({ label: label.name }) : m.label_hide({ label: label.name })}
          data-tip={allHidden ? m.label_show({ label: label.name }) : m.label_hide({ label: label.name })}
          onClick={() => void onChange({ type: 'label.hide', label: label.name, hidden: !allHidden })}
        >
          {allHidden ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
        </Button>
      )}
      <Button
        className="grid place-items-center px-2.5"
        aria-label={m.label_delete({ label: label.name })}
        data-tip={m.label_delete({ label: label.name })}
        onClick={() => void onChange({ type: 'label.rename', from: label.name, to: null })}
      >
        <Trash2 size={14} aria-hidden />
      </Button>
    </li>
  )
}
