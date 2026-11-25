import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, moveOccurrence, type Occurrence, type PlanChange } from '@lc/plan-domain'
import { Button, FOOT, META, Modal, Timer, TITLE } from '@lc/ui'
import { useState } from 'react'

const MINUTE = 60_000

/** A done session whose length was changed in the grid, and the slot it was dropped on. */
export interface ResizedDone {
  event: Occurrence
  slot: { s: number; e: number }
}

interface Props {
  /** The dialog is open while there is one */
  resized: ResizedDone | null
  /** Stores the change. Rejects with the reason when it cannot be stored: the dialog shows it */
  onChange: (change: PlanChange) => Promise<void>
  onClose: () => void
}

/**
 * Asks what a resize of a done session meant: the time it really took, or a new plan. The block in the calendar is
 * the plan, and a forecast compares the logged time with it, so a resize must not change both at once.
 */
export function ResizedDoneDialog({ resized, onChange, onClose }: Props) {
  return (
    <Modal open={resized !== null} onClose={onClose}>
      {resized && (
        <Choice
          key={`${resized.event.uid}@${resized.slot.s}-${resized.slot.e}`}
          {...resized}
          onChange={onChange}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

function Choice({ event, slot, onChange, onClose }: ResizedDone & Omit<Props, 'resized'>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const minutes = Math.round((slot.e - slot.s) / MINUTE)

  async function store(change: PlanChange) {
    setBusy(true)
    setError('')
    try {
      await onChange(change)
      onClose()
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h3 className={TITLE}>{m.resize_done_title()}</h3>
      <p className={META}>{m.resize_done_hint()}</p>
      <p className="mt-2 truncate text-[13px] text-muted tabular-nums">
        {event.title} · {m.spent_planned({ time: fmtDuration(event.e - event.s) })} ·{' '}
        {event.actual === undefined ? m.spent_not_logged() : fmtDuration(event.actual * MINUTE)}
      </p>
      {/* The first button takes the focus when the dialog opens: logging the time is the default. */}
      <div className="mt-3 grid gap-2">
        <Button
          primary
          disabled={busy}
          className="flex items-center justify-center gap-1.5"
          onClick={() => void store({ type: 'event.patch', uid: event.uid, patch: { actual: minutes } })}
        >
          <Timer size={15} aria-hidden />
          {m.resize_done_time({ time: fmtDuration(minutes * MINUTE) })}
        </Button>
        <Button disabled={busy} onClick={() => void store(moveOccurrence(event, slot))}>
          {m.resize_done_plan({ slot: `${hm(slot.s)}–${hm(slot.e)}` })}
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-[13px] text-today-ink" role="alert">
          {error}
        </p>
      )}
      <div className={FOOT}>
        <Button onClick={onClose}>{m.cancel()}</Button>
      </div>
    </>
  )
}
