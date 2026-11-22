import { m } from '@lc/i18n/messages'
import type { PlanCalendar } from '@lc/plan-domain'
import { Button, FIELD, FOOT, INPUT, TITLE } from '@lc/ui'
import { useEffect, useState, type FormEvent } from 'react'

export interface EventFormValues {
  title: string
  description: string
  calendar: string
  start: string
  end: string
  availability: 'busy' | 'free'
}

interface Props {
  heading: string
  initial: EventFormValues
  calendars: PlanCalendar[]
  /** All-day events have a date only */
  allDay?: boolean
  /** A repeating event: the note says the change covers every repeat */
  recurring?: boolean
  /** Only a new event chooses whether it counts toward the budget */
  chooseAvailability?: boolean
  busy: boolean
  error: string
  onCancel: () => void
  onSubmit: (values: EventFormValues) => void
  onProblem: (message: string) => void
  /** Called with the fields as they stand after every change, so the page can show the event before it is saved */
  onValues?: (values: EventFormValues) => void
}

export function EventForm({
  heading,
  initial,
  calendars,
  allDay = false,
  recurring = false,
  chooseAvailability = false,
  busy,
  error,
  onCancel,
  onSubmit,
  onProblem,
  onValues,
}: Props) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [calendar, setCalendar] = useState(initial.calendar)
  const [date, setDate] = useState(initial.start.slice(0, 10))
  const [from, setFrom] = useState(initial.start.slice(11, 16))
  const [to, setTo] = useState(initial.end.slice(11, 16))
  const [free, setFree] = useState(initial.availability === 'free')

  const values: EventFormValues = {
    title: title.trim(),
    description,
    calendar,
    start: `${date}T${allDay ? '00:00' : from}`,
    end: `${date}T${allDay ? '00:00' : to}`,
    availability: free ? 'free' : 'busy',
  }
  useEffect(() => {
    onValues?.({
      title: title.trim(),
      description,
      calendar,
      start: values.start,
      end: values.end,
      availability: values.availability,
    })
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the fields are the trigger, not the callback's identity
  }, [title, description, calendar, values.start, values.end, values.availability])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return onProblem(m.error_title_required())
    if (!allDay && to <= from) return onProblem(m.error_time_order())
    onSubmit(values)
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <h3 className={TITLE}>{heading}</h3>
      <label className={FIELD}>
        {m.field_title()}
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- the dialog was opened to type here */}
        <input className={INPUT} value={title} required autoFocus onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className={FIELD}>
        {m.field_calendar()}
        <select className={INPUT} value={calendar} onChange={(e) => setCalendar(e.target.value)}>
          {calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
        <label className={`${FIELD} col-span-2 md:col-span-1`}>
          {m.field_date()}
          <input className={INPUT} type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
        </label>
        {!allDay && (
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
      {recurring && <p className="text-[13px] text-muted">{m.recurring_hint()}</p>}
      {chooseAvailability && (
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} />
          {m.field_free_time()}
        </label>
      )}
      <label className={FIELD}>
        {m.field_description()}
        <textarea
          className={`${INPUT} min-h-[120px] resize-y text-[14px]/[1.5]`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {error && (
        <p className="text-[13px] text-today-ink" role="alert">
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
