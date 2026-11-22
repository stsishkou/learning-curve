import { m } from '@lc/i18n/messages'
import type { Plan, PlanCalendar, PlanChange } from '@lc/plan-domain'
import { Button, FOOT, INPUT, META, Modal, TITLE } from '@lc/ui'
import { useState, type FormEvent } from 'react'

/** Offered for a new calendar: the first one no calendar uses yet. */
const PALETTE = ['#0f8fc4', '#5b8c2a', '#d8473b', '#b0562b', '#3f51b5', '#00897b', '#9c27b0', '#6b7280']

interface Props {
  plan: Plan
  open: boolean
  /** Rejects with the reason when the change cannot be stored */
  onChange: (change: PlanChange) => Promise<void>
  /** The last change that can be taken back, shown here because the dialog covers the page's undo bar */
  undo: { label: string; run: () => Promise<void> } | null | false
  /** How many things wait in the trash, and the way to open it */
  trashCount: number
  onOpenTrash: () => void
  onClose: () => void
}

/** Rename and recolor any calendar, add new ones, clear or remove any of them: what is removed goes to the trash. */
export function CalendarsDialog({ plan, open, onChange, undo, trashCount, onOpenTrash, onClose }: Props) {
  const [error, setError] = useState('')
  const counts = new Map<string, number>()
  for (const e of plan.events) counts.set(e.calendar, (counts.get(e.calendar) ?? 0) + 1)
  const used = new Set(plan.calendars.map((c) => c.color.toLowerCase()))
  const freeColor = PALETTE.find((color) => !used.has(color)) ?? PALETTE[0]

  async function run(change: PlanChange) {
    try {
      await onChange(change)
      setError('')
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className={TITLE}>{m.calendars()}</h3>
      <div className={META}>{m.calendars_hint()}</div>
      <ul className="mt-3.5 grid gap-1.5">
        {plan.calendars.map((c) => (
          <li key={c.id}>
            <CalendarRow
              // Remounts when the stored value changes, so the fields show what was saved.
              key={`${c.name}|${c.color}`}
              calendar={c}
              events={counts.get(c.id) ?? 0}
              onSave={(name, color) => run({ type: 'calendar.save', id: c.id, name, color })}
              onClear={counts.get(c.id) ? () => run({ type: 'calendar.clear', id: c.id }) : undefined}
              onRemove={plan.calendars.length > 1 ? () => run({ type: 'calendar.remove', id: c.id }) : undefined}
            />
          </li>
        ))}
      </ul>
      <h4 className="mt-4 mb-1.5 text-[13px] font-semibold text-muted">{m.new_calendar()}</h4>
      <CalendarRow
        key={`new|${plan.calendars.length}`}
        calendar={{ id: '', name: '', color: freeColor, isNew: true }}
        events={null}
        onSave={(name, color) => run({ type: 'calendar.save', name, color })}
      />
      {error && (
        <p className="mt-2 text-[13px] text-today-ink" role="alert">
          {error}
        </p>
      )}
      {undo && (
        <p className="mt-3 flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-[13.5px]" role="status">
          <span className="min-w-0 flex-1 truncate">{undo.label}</span>
          <button
            type="button"
            className="font-semibold text-focus hover:underline"
            onClick={() => void undo.run().catch((err: unknown) => setError(String(err)))}
          >
            {m.undo()}
          </button>
        </p>
      )}
      <div className={FOOT}>
        <span className="mr-auto flex items-center gap-2.5 text-[12.5px] text-muted">
          <Button onClick={onOpenTrash}>
            {m.trash()}
            {trashCount > 0 && <em className="ml-1.5 text-muted not-italic tabular-nums">{trashCount}</em>}
          </Button>
        </span>
        <Button onClick={onClose}>{m.close()}</Button>
      </div>
    </Modal>
  )
}

interface RowProps {
  calendar: PlanCalendar
  /** null for the row that adds a calendar */
  events: number | null
  onSave: (name: string, color: string) => Promise<void>
  onClear?: () => Promise<void>
  onRemove?: () => Promise<void>
}

function CalendarRow({ calendar, events, onSave, onClear, onRemove }: RowProps) {
  const [name, setName] = useState(calendar.name)
  const [color, setColor] = useState(calendar.color)
  const adding = events === null
  const dirty = name.trim() !== calendar.name || color.toLowerCase() !== calendar.color.toLowerCase()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim()) void onSave(name.trim(), color)
  }

  return (
    <form className="flex items-center gap-2" onSubmit={submit}>
      <input
        type="color"
        className="size-9 flex-none cursor-pointer rounded-lg border border-line bg-surface-2 p-1"
        aria-label={m.field_color()}
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <input
        className={`${INPUT} min-w-0 flex-1`}
        aria-label={m.field_calendar_name()}
        placeholder={adding ? m.calendar_name_placeholder() : undefined}
        value={name}
        required
        onChange={(e) => setName(e.target.value)}
      />
      {!adding && (
        <em className="hidden flex-none text-[12.5px] whitespace-nowrap text-muted not-italic tabular-nums md:inline">
          {m.events_count({ count: events })}
        </em>
      )}
      {(adding || dirty) && (
        <Button primary type="submit" disabled={!name.trim()}>
          {adding ? m.add() : m.save()}
        </Button>
      )}
      {onClear && !dirty && (
        <Button title={m.clear_calendar_hint()} onClick={() => void onClear()}>
          {m.clear_calendar()}
        </Button>
      )}
      {onRemove && !dirty && (
        <Button
          aria-label={m.delete_calendar({ name: calendar.name })}
          title={m.delete_calendar({ name: calendar.name })}
          onClick={() => void onRemove()}
        >
          ✕
        </Button>
      )}
    </form>
  )
}
