import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, parseLocal, TRASH_DAYS, type Plan, type PlanChange, type PlanTrash } from '@lc/plan-domain'
import { Button, calendarColor, Dot, FOOT, META, Modal, TITLE } from '@lc/ui'
import { useState, type ReactNode } from 'react'

interface Props {
  /** The plan on screen: where a removed event's calendar gets its name and color */
  plan: Plan
  /** The removed events and calendars, each with the day it was removed */
  trash: PlanTrash
  /** The parent owns it and sets it to false in `onClose` */
  open: boolean
  /** Stores one change. Rejects with the reason when it cannot be stored: the dialog shows it */
  onChange: (change: PlanChange) => Promise<void>
  onClose: () => void
}

/** Removed events and calendars wait here for `TRASH_DAYS` days: each can be restored, or all removed for good. */
export function TrashDialog({ plan, trash, open, onChange, onClose }: Props) {
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const empty = !trash.events.length && !trash.calendars.length

  async function run(change: PlanChange) {
    try {
      await onChange(change)
      setError('')
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    }
    setConfirming(false)
  }

  return (
    <Modal
      open={open}
      size="wide"
      onClose={() => {
        setConfirming(false)
        onClose()
      }}
    >
      <h3 className={TITLE}>{m.trash()}</h3>
      <div className={META}>{m.trash_hint({ days: TRASH_DAYS })}</div>

      {empty && <p className="mt-6 mb-2 text-center text-[14px] text-muted">{m.trash_empty()}</p>}

      {trash.calendars.length > 0 && (
        <Section title={m.calendars()}>
          {trash.calendars.map(({ calendar, events, daysLeft }) => (
            <Row
              key={calendar.id}
              color={calendar.color}
              title={calendar.name}
              detail={m.events_count({ count: events })}
              daysLeft={daysLeft}
              onRestore={() => void run({ type: 'trash.restore', calendars: [calendar.id] })}
            />
          ))}
        </Section>
      )}
      {trash.events.length > 0 && (
        <Section title={m.stat_events()}>
          {trash.events.map(({ event, daysLeft }) => {
            const calendar = plan.calendars.find((c) => c.id === event.calendar)
            const s = parseLocal(event.start)
            return (
              <Row
                key={event.uid}
                color={calendar?.color}
                title={event.title}
                detail={`${calendar?.name ?? ''} · ${fmtDay(s)}${event.allDay ? '' : ` ${hm(s)}`}`}
                daysLeft={daysLeft}
                onRestore={() => void run({ type: 'trash.restore', events: [event.uid] })}
              />
            )
          })}
        </Section>
      )}

      {error && (
        <p className="mt-2 text-[13px] text-today-ink" role="alert">
          {error}
        </p>
      )}
      <div className={FOOT}>
        {!empty && (
          <span className="mr-auto flex flex-wrap items-center gap-2">
            {confirming ? (
              <>
                <span className="text-[13px] text-today-ink">{m.trash_empty_confirm()}</span>
                <Button className="border-today text-today-ink" onClick={() => void run({ type: 'trash.empty' })}>
                  {m.trash_empty_now()}
                </Button>
                <Button onClick={() => setConfirming(false)}>{m.cancel()}</Button>
              </>
            ) : (
              <>
                <Button onClick={() => void run({ type: 'trash.restore' })}>{m.trash_restore_all()}</Button>
                <Button onClick={() => setConfirming(true)}>{m.trash_empty_now()}</Button>
              </>
            )}
          </span>
        )}
        <Button onClick={onClose}>{m.close()}</Button>
      </div>
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h4 className="mt-4 mb-1.5 text-[13px] font-semibold text-muted">{title}</h4>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">{children}</ul>
    </>
  )
}

interface RowProps {
  color: string | undefined
  title: string
  detail: string
  daysLeft: number
  onRestore: () => void
}

function Row({ color, title, detail, daysLeft, onRestore }: RowProps) {
  return (
    <li
      className="flex items-center gap-2.5 rounded-xl border border-line-soft px-3 py-2 text-[13.5px]"
      style={calendarColor(color)}
    >
      <Dot className="size-2.5 flex-none" />
      <span className="min-w-0 flex-1">
        <b className="block truncate font-medium">{title}</b>
        <small className="block truncate text-[12.5px] text-muted tabular-nums">{detail}</small>
      </span>
      <em
        className={`flex-none text-[12.5px] whitespace-nowrap not-italic tabular-nums ${daysLeft <= 3 ? 'text-today-ink' : 'text-muted'}`}
      >
        {m.trash_days_left({ count: daysLeft })}
      </em>
      <Button aria-label={`${m.restore()}: ${title}`} onClick={onRestore}>
        {m.restore()}
      </Button>
    </li>
  )
}
