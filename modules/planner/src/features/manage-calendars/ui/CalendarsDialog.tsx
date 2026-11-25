import { m } from '@lc/i18n/messages'
import { planLabels, type Plan, type PlanCalendar, type PlanChange } from '@lc/plan-domain'
import { Button, Eye, EyeOff, FOOT, GraduationCap, GripVertical, INPUT, META, Modal, TITLE, Trash2 } from '@lc/ui'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'

import { freeColor } from '../model/palette'
import { useReorder, type HandleProps } from '../model/use-reorder'
import { CalendarLabels } from './CalendarLabels'
import { LabelsSection } from './LabelsSection'

/** A screen reader speaks over a focus that comes back after a move; the position waits for it. */
const SAY_AFTER_MS = 500

interface Props {
  /** The whole plan, hidden calendars included: they are shown again from here */
  plan: Plan
  /** The parent owns it and sets it to false in `onClose` */
  open: boolean
  /** Stores one change. Rejects with the reason when it cannot be stored: the dialog shows it */
  onChange: (change: PlanChange) => Promise<void>
  /** The last change that can be taken back, shown here because the dialog covers the page's undo bar */
  undo: { label: string; run: () => Promise<void> } | null | false
  /** How many things wait in the trash, and the way to open it */
  trashCount: number
  onOpenTrash: () => void
  /** Opens the form that adds a whole course with its sessions */
  onNewCourse?: (() => void) | undefined
  onClose: () => void
}

/**
 * Rename, recolor, reorder, label and hide any calendar, add new ones, clear or remove any of them: what is removed
 * goes to the trash. A hidden calendar stays here, dimmed, to be shown again. Under the calendars, every label with
 * its own rename, remove and hide.
 */
export function CalendarsDialog({ plan, open, onChange, undo, trashCount, onOpenTrash, onNewCourse, onClose }: Props) {
  const [error, setError] = useState('')
  const [said, setSaid] = useState('')
  const [labelling, setLabelling] = useState<string | null>(null)
  const list = useRef<HTMLUListElement>(null)
  const refocus = useRef<string | null>(null)
  const saying = useRef<ReturnType<typeof setTimeout>>(undefined)
  const counts = new Map<string, number>()
  for (const e of plan.events) counts.set(e.calendar, (counts.get(e.calendar) ?? 0) + 1)
  const ids = plan.calendars.map((c) => c.id)
  const shownCount = plan.calendars.filter((c) => !c.hidden).length
  const known = planLabels(plan).map((label) => label.name)

  async function run(change: PlanChange) {
    try {
      await onChange(change)
      setError('')
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    }
  }

  async function takeBack(step: () => Promise<void>) {
    try {
      await step()
    } catch (err) {
      setError(String(err))
    }
  }

  const reorder = useReorder(ids, list, (next, id) => {
    refocus.current = id
    const name = plan.calendars.find((c) => c.id === id)?.name ?? ''
    setSaid('')
    clearTimeout(saying.current)
    saying.current = setTimeout(
      () => setSaid(m.calendar_moved({ name, position: next.indexOf(id) + 1, count: next.length })),
      SAY_AFTER_MS,
    )
    void run({ type: 'calendars.order', ids: next })
  })
  useEffect(() => () => clearTimeout(saying.current), [])
  useEffect(() => {
    if (!open) setLabelling(null)
  }, [open])

  // A moved row is put back in the list by React, which can take the focus from its handle: give it back.
  const order = ids.join()
  useEffect(() => {
    const id = refocus.current
    if (id === null) return
    refocus.current = null
    const handle = list.current?.querySelector<HTMLElement>(`[data-handle="${CSS.escape(id)}"]`)
    handle?.closest('li')?.scrollIntoView({ block: 'nearest' })
    if (handle && document.activeElement !== handle) handle.focus({ preventScroll: true })
  }, [order])

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className={TITLE}>{m.calendars()}</h3>
      <div className={META}>{m.calendars_hint()}</div>
      <div className="relative mt-3.5">
        <ul ref={list} className="relative grid gap-1.5">
          {plan.calendars.map((c) => (
            <li
              key={c.id}
              data-id={c.id}
              className={
                reorder.dragged === c.id ? 'relative z-10 scale-[1.01] rounded-xl bg-surface shadow-card' : undefined
              }
              style={reorder.dragged === c.id ? { translate: `0 ${reorder.offset}px` } : undefined}
            >
              <CalendarRow
                // Remounts when the stored value changes, so the fields show what was saved.
                key={`${c.name}|${c.color}`}
                calendar={c}
                events={counts.get(c.id) ?? 0}
                handle={plan.calendars.length > 1 ? reorder.handle(c.id) : undefined}
                onSave={(name, color) => run({ type: 'calendar.save', id: c.id, name, color })}
                onHide={
                  c.hidden || shownCount > 1
                    ? () => run({ type: 'calendar.hide', id: c.id, hidden: !c.hidden })
                    : undefined
                }
                onClear={counts.get(c.id) ? () => run({ type: 'calendar.clear', id: c.id }) : undefined}
                onRemove={plan.calendars.length > 1 ? () => run({ type: 'calendar.remove', id: c.id }) : undefined}
              />
              {/* Under the name: past the handle and the color, w-6 + gap-2 + size-9 + gap-2. */}
              <div className="pt-1 pb-1.5 pl-[76px]">
                <CalendarLabels
                  calendar={c}
                  known={known}
                  adding={labelling === c.id}
                  onAdding={(adding) => setLabelling(adding ? c.id : null)}
                  onChange={(labels) => run({ type: 'calendar.labels', id: c.id, labels })}
                />
              </div>
            </li>
          ))}
        </ul>
        {reorder.marker !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 h-0.5 -translate-y-1/2 rounded-full bg-focus forced-colors:bg-[Highlight]"
            style={{ top: reorder.marker }}
          />
        )}
      </div>
      <p className="sr-only" role="status">
        {said}
      </p>
      <LabelsSection plan={plan} onChange={run} />
      <div className="mt-4 mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[13px] font-semibold text-muted">{m.new_calendar()}</h4>
        {onNewCourse && (
          <Button
            className="inline-flex items-center gap-1.5"
            icon={<GraduationCap size={15} aria-hidden />}
            label={m.new_course()}
            onClick={onNewCourse}
          />
        )}
      </div>
      <CalendarRow
        key={`new|${plan.calendars.length}`}
        calendar={{ id: '', name: '', color: freeColor(plan), isNew: true }}
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
            onClick={() => void takeBack(undo.run)}
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
  /** The drag handle that reorders the row; absent for the row that adds a calendar and for a lone calendar */
  handle?: HandleProps | undefined
  onSave: (name: string, color: string) => Promise<void>
  /** Hides a shown calendar or shows a hidden one; absent for the last calendar shown */
  onHide?: (() => Promise<void>) | undefined
  onClear?: (() => Promise<void>) | undefined
  onRemove?: (() => Promise<void>) | undefined
}

function CalendarRow({ calendar, events, handle, onSave, onHide, onClear, onRemove }: RowProps) {
  const [name, setName] = useState(calendar.name)
  const [color, setColor] = useState(calendar.color)
  const adding = events === null
  const dirty = name.trim() !== calendar.name || color.toLowerCase() !== calendar.color.toLowerCase()
  const hidden = calendar.hidden === true

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (name.trim()) void onSave(name.trim(), color)
  }

  return (
    <form className="flex items-center gap-2" onSubmit={submit}>
      {handle ? (
        <button
          type="button"
          data-handle={calendar.id}
          className="grid h-9 w-6 flex-none cursor-grab touch-none place-items-center rounded-md text-muted select-none hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 focus-visible:text-ink active:cursor-grabbing"
          aria-label={m.calendar_move({ name: calendar.name })}
          data-tip={m.calendar_move({ name: calendar.name })}
          {...handle}
        >
          <GripVertical size={15} aria-hidden />
        </button>
      ) : (
        <span className="w-6 flex-none" aria-hidden />
      )}
      <input
        type="color"
        className={`size-9 flex-none cursor-pointer rounded-lg border border-line bg-surface-2 p-1 ${hidden ? 'opacity-45' : ''}`}
        aria-label={m.field_color()}
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <input
        className={`${INPUT} min-w-0 flex-1 ${hidden ? 'text-muted' : ''}`}
        aria-label={m.field_calendar_name()}
        placeholder={adding ? m.calendar_name_placeholder() : undefined}
        value={name}
        required
        onChange={(e) => setName(e.target.value)}
      />
      {!adding && (
        <em className="hidden flex-none text-[12.5px] whitespace-nowrap text-muted not-italic tabular-nums md:inline">
          {hidden ? `${m.calendar_hidden()} · ` : ''}
          {m.events_count({ count: events })}
        </em>
      )}
      {(adding || dirty) && (
        <Button primary type="submit" disabled={!name.trim()}>
          {adding ? m.add() : m.save()}
        </Button>
      )}
      {onHide && !dirty && (
        <Button
          aria-label={hidden ? m.calendar_show({ name: calendar.name }) : m.calendar_hide({ name: calendar.name })}
          data-tip={hidden ? m.calendar_show({ name: calendar.name }) : m.calendar_hide({ name: calendar.name })}
          onClick={() => void onHide()}
        >
          {hidden ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
        </Button>
      )}
      {onClear && !dirty && (
        <Button data-tip={m.clear_calendar_hint()} onClick={() => void onClear()}>
          {m.clear_calendar()}
        </Button>
      )}
      {onRemove && !dirty && (
        <Button
          aria-label={m.delete_calendar({ name: calendar.name })}
          data-tip={m.delete_calendar({ name: calendar.name })}
          onClick={() => void onRemove()}
        >
          <Trash2 size={15} aria-hidden />
        </Button>
      )}
    </form>
  )
}
