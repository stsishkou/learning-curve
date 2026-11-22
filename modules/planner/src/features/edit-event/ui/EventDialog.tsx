import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  hm,
  isCustomEvent,
  isSession,
  parseLocal,
  type NewEvent,
  type Plan,
  type PlanChange,
  type PlanEvent,
} from '@lc/plan-domain'
import { Button, calendarColor, Dot, FOOT, META, Modal, TITLE } from '@lc/ui'
import { useState } from 'react'

import { EventForm } from './EventForm'
import { EventNudge } from './EventNudge'

const URL_PATTERN = /(https?:\/\/\S+)/g

const linkify = (text: string) =>
  text.split(URL_PATTERN).map((part, i) =>
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
  /** For a repeating event: the day of the repeat that was opened, `YYYY-MM-DD` */
  day?: string | null
  /** Called when the opened repeat is moved to another day */
  onDayChange?: (day: string) => void
  /** A new event to create: the dialog opens as a form filled with these values */
  draft: NewEvent | null
  /** true when the event already differs from the generated schedule */
  edited: boolean
  canEdit: boolean
  /** Rejects with the reason when the change cannot be stored */
  onChange: (change: PlanChange) => Promise<void>
  onClose: () => void
}

export function EventDialog({
  plan,
  event,
  day = null,
  onDayChange,
  draft,
  edited,
  canEdit,
  onChange,
  onClose,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const close = () => {
    setEditing(false)
    setError('')
    onClose()
  }

  async function run(change: PlanChange, then: 'stay' | 'close' = 'stay') {
    setBusy(true)
    setError('')
    try {
      await onChange(change)
      setEditing(false)
      if (then === 'close') close()
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
  const courseUrl = event?.description.match(URL_PATTERN)?.[0]

  return (
    <Modal open={!!event || !!draft} onClose={close}>
      {draft && !event && (
        <EventForm
          // A fresh form per slot, so fields never carry over from the previous one.
          key={draft.start}
          heading={m.new_event()}
          initial={draft}
          calendars={plan.calendars}
          chooseAvailability
          busy={busy}
          error={error}
          onCancel={close}
          onSubmit={(values) => void run({ type: 'event.add', event: values }, 'close')}
          onProblem={setError}
        />
      )}
      {event && editing && (
        <EventForm
          key={event.uid}
          heading={m.edit()}
          initial={{ ...event }}
          calendars={plan.calendars}
          allDay={event.allDay}
          recurring={!!event.rrule}
          busy={busy}
          error={error}
          onCancel={() => (setEditing(false), setError(''))}
          onSubmit={({ availability: _unchanged, ...patch }) =>
            void run({ type: 'event.patch', uid: event.uid, patch })
          }
          onProblem={setError}
        />
      )}
      {event && !editing && (
        <>
          <h3 className={`${TITLE} ${event.done ? 'text-muted line-through decoration-done' : ''}`}>{event.title}</h3>
          <div className={META} style={calendarColor(calendar?.color)}>
            <Dot className="size-2.5" />
            {calendar?.name}, {when}
            {event.availability === 'free' ? `, ${m.event_free()}` : ''}
            {event.done && (
              <span className="rounded-md border border-current px-[5px] text-[11.5px] text-done">{m.done()}</span>
            )}
            {edited && (
              <span className="rounded-md border border-current px-[5px] text-[11.5px] text-focus">
                {isCustomEvent(event) ? m.event_added() : m.event_edited()}
              </span>
            )}
          </div>
          {event.description && (
            <pre className="mt-3.5 rounded-[10px] bg-surface-2 px-3.5 py-3 font-sans text-[14px]/[1.55] wrap-anywhere whitespace-pre-wrap">
              {linkify(event.description)}
            </pre>
          )}
          {canEdit && (
            <EventNudge
              event={event}
              day={day}
              disabled={busy}
              onMove={(patch, landed) => {
                onDayChange?.(landed)
                void run({ type: 'event.patch', uid: event.uid, patch })
              }}
            />
          )}
          {error && (
            <p className="mt-2 text-[13px] text-today" role="alert">
              {error}
            </p>
          )}
          <div className={FOOT}>
            <span className="mr-auto flex flex-wrap gap-2">
              {canEdit && (
                <Button
                  disabled={busy}
                  title={m.delete_event_hint()}
                  onClick={() => void run({ type: 'event.remove', uid: event.uid }, 'close')}
                >
                  {event.rrule ? m.delete_series() : m.delete_event()}
                </Button>
              )}
              {canEdit && event.rrule && day && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(
                      { type: 'event.patch', uid: event.uid, patch: { skip: [...(event.skip ?? []), day] } },
                      'close',
                    )
                  }
                >
                  {m.skip_day({ date: fmtDay(parseLocal(day)) })}
                </Button>
              )}
              {canEdit && edited && !isCustomEvent(event) && (
                <Button disabled={busy} onClick={() => void run({ type: 'event.patch', uid: event.uid, patch: null })}>
                  {m.reset_event()}
                </Button>
              )}
              {courseUrl && (
                <a
                  className="rounded-[10px] border border-line bg-surface px-3.5 py-2 font-medium shadow-card hover:bg-surface-2"
                  href={courseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {m.open_course()} ↗
                </a>
              )}
            </span>
            {canEdit && isSession(event) && (
              <Button
                className={event.done ? '' : 'border-done text-done'}
                disabled={busy}
                onClick={() => void run({ type: 'event.patch', uid: event.uid, patch: { done: !event.done } })}
              >
                {event.done ? m.mark_not_done() : `✓ ${m.mark_done()}`}
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
