import { useState, type FormEvent } from 'react'

import { fmtDay } from '#/lib/format'
import { hm, parseLocal } from '#/lib/plan/dates'
import type { EventPatch } from '#/lib/plan/edits'
import type { Plan, PlanEvent } from '#/lib/plan/types'
import { m } from '#/paraglide/messages.js'

import { FOOT, META, Modal, TITLE } from './Modal'
import { Button, Dot, calendarColor } from './ui'

const FIELD = 'grid gap-1 text-[13px] text-muted'
const INPUT = 'w-full rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-[15px] text-ink'

const linkify = (text: string) =>
  text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      // oxlint-disable-next-line react/no-array-index-key -- the parts of one description never reorder
      <a key={i} className="text-focus underline" href={part} target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  )

interface Props {
  plan: Plan
  event: PlanEvent | null
  /** true when the event already differs from the generated schedule */
  edited: boolean
  canEdit: boolean
  /** `null` drops the manual changes; rejects with the reason when saving fails */
  onSave: (uid: string, patch: EventPatch | null) => Promise<void>
  onClose: () => void
}

export function EventDialog({ plan, event, edited, canEdit, onSave, onClose }: Props) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const close = () => {
    setEditing(false)
    setError('')
    onClose()
  }

  async function run(uid: string, patch: EventPatch | null) {
    setBusy(true)
    setError('')
    try {
      await onSave(uid, patch)
      setEditing(false)
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  const calendar = plan.calendars.find((c) => c.id === event?.calendar)
  let when = ''
  if (event) {
    const s = parseLocal(event.start)
    const e = parseLocal(event.end)
    when = event.rrule
      ? m.event_recurring({ from: hm(s), to: hm(e), date: fmtDay(s) })
      : event.allDay
        ? m.event_all_day({ date: fmtDay(s) })
        : `${fmtDay(s)} ${hm(s)}–${hm(e)}`
  }

  return (
    <Modal open={!!event} onClose={close}>
      {event && editing && (
        <EventForm
          // A fresh form per event, so fields never carry over from the previous one.
          key={event.uid}
          event={event}
          busy={busy}
          error={error}
          onCancel={() => (setEditing(false), setError(''))}
          onSubmit={(patch) => void run(event.uid, patch)}
          onProblem={setError}
        />
      )}
      {event && !editing && (
        <>
          <h3 className={TITLE}>{event.title}</h3>
          <div className={META} style={calendarColor(calendar?.color)}>
            <Dot className="size-2.5" />
            {calendar?.name}, {when}
            {event.availability === 'free' ? `, ${m.event_free()}` : ''}
            {edited && (
              <span className="rounded-md border border-current px-[5px] text-[11.5px] text-focus">
                {m.event_edited()}
              </span>
            )}
          </div>
          {event.description && (
            <pre className="mt-3.5 rounded-[10px] bg-surface-2 px-3.5 py-3 font-sans text-[14px]/[1.55] wrap-anywhere whitespace-pre-wrap">
              {linkify(event.description)}
            </pre>
          )}
          {error && (
            <p className="mt-2 text-[13px] text-today" role="alert">
              {error}
            </p>
          )}
          <div className={FOOT}>
            {canEdit && edited && (
              <Button className="mr-auto" disabled={busy} onClick={() => void run(event.uid, null)}>
                {m.reset_event()}
              </Button>
            )}
            {canEdit && (
              <Button primary onClick={() => setEditing(true)}>
                {m.edit()}
              </Button>
            )}
            <Button onClick={close}>{m.close()}</Button>
          </div>
        </>
      )}
    </Modal>
  )
}

interface FormProps {
  event: PlanEvent
  busy: boolean
  error: string
  onCancel: () => void
  onSubmit: (patch: EventPatch) => void
  onProblem: (message: string) => void
}

function EventForm({ event, busy, error, onCancel, onSubmit, onProblem }: FormProps) {
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description)
  const [date, setDate] = useState(event.start.slice(0, 10))
  const [from, setFrom] = useState(event.start.slice(11, 16))
  const [to, setTo] = useState(event.end.slice(11, 16))

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return onProblem(m.error_title_required())
    if (!event.allDay && to <= from) return onProblem(m.error_time_order())
    onSubmit({
      title: title.trim(),
      description,
      start: `${date}T${event.allDay ? '00:00' : from}`,
      end: `${date}T${event.allDay ? '00:00' : to}`,
    })
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <h3 className={TITLE}>{m.edit()}</h3>
      <label className={FIELD}>
        {m.field_title()}
        <input className={INPUT} value={title} required onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
        <label className={`${FIELD} col-span-2 md:col-span-1`}>
          {m.field_date()}
          <input className={INPUT} type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
        </label>
        {!event.allDay && (
          <>
            <label className={FIELD}>
              {m.field_start()}
              <input
                className={INPUT}
                type="time"
                step={900}
                value={from}
                required
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className={FIELD}>
              {m.field_end()}
              <input
                className={INPUT}
                type="time"
                step={900}
                value={to}
                required
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </>
        )}
      </div>
      {event.rrule && <p className="text-[13px] text-muted">{m.recurring_hint()}</p>}
      <label className={FIELD}>
        {m.field_description()}
        <textarea
          className={`${INPUT} min-h-[140px] resize-y text-[14px]/[1.5]`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {error && (
        <p className="text-[13px] text-today" role="alert">
          {error}
        </p>
      )}
      <div className={`${FOOT} mt-1`}>
        <Button onClick={onCancel}>{m.cancel()}</Button>
        <Button primary type="submit" disabled={busy}>
          {m.save()}
        </Button>
      </div>
    </form>
  )
}
