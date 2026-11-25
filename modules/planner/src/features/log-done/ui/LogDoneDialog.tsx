import { fmtDay, fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, parseLocal, type Plan, type PlanChange } from '@lc/plan-domain'
import { Button, calendarColor, Dot, FOOT, META, Modal, TITLE } from '@lc/ui'
import { useState } from 'react'

import { TimeChoices } from '../../../shared/ui'

const MINUTE = 60_000

interface Props {
  plan: Plan
  /** The sessions to mark done; the dialog is open while there are any */
  uids: string[]
  /** Stores the change. Rejects with the reason when it cannot be stored: the dialog shows it */
  onChange: (change: PlanChange) => Promise<void>
  onClose: () => void
}

/**
 * Marks several sessions done at once and asks how long each took, so a bulk action does not leave them all
 * without a time. A row left without one is marked done without a time, as a choice the dialog counts.
 */
export function LogDoneDialog({ plan, uids, onChange, onClose }: Props) {
  return (
    <Modal open={uids.length > 0} onClose={onClose}>
      {uids.length > 0 && <Rows key={uids.join()} plan={plan} uids={uids} onChange={onChange} onClose={onClose} />}
    </Modal>
  )
}

function Rows({ plan, uids, onChange, onClose }: Props) {
  const [times, setTimes] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sessions = uids.flatMap((uid) => plan.events.find((e) => e.uid === uid) ?? [])
  const unlogged = sessions.filter((e) => times[e.uid] === undefined).length

  async function save() {
    setBusy(true)
    setError('')
    try {
      const actual = Object.keys(times).length ? { actual: times } : {}
      await onChange({ type: 'events.done', uids, done: true, ...actual })
      onClose()
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h3 className={TITLE}>{m.log_done_title({ count: sessions.length })}</h3>
      <p className={META}>{m.log_done_hint()}</p>
      <ul className="mt-3 grid max-h-[55dvh] gap-3 overflow-y-auto">
        {sessions.map((e) => {
          const s = parseLocal(e.start)
          const planned = (parseLocal(e.end) - s) / MINUTE
          const chosen = times[e.uid]
          return (
            <li
              key={e.uid}
              className="grid gap-1.5 border-b border-line-soft pb-3 last:border-b-0"
              style={calendarColor(plan.calendars.find((c) => c.id === e.calendar)?.color ?? '')}
            >
              <span className="flex min-w-0 items-baseline gap-2 text-[13.5px]">
                <Dot className="size-2.5 shrink-0 -translate-y-px" />
                <b className="truncate font-semibold">{e.title}</b>
              </span>
              <span className="text-[12.5px] text-muted tabular-nums">
                {fmtDay(s)} {hm(s)} · {m.spent_planned({ time: fmtDuration(planned * MINUTE) })} ·{' '}
                {chosen === undefined ? m.spent_not_logged() : fmtDuration(chosen * MINUTE)}
              </span>
              <TimeChoices
                planned={planned}
                chosen={chosen}
                disabled={busy}
                onChoose={(minutes) => setTimes((sofar) => ({ ...sofar, [e.uid]: minutes }))}
              />
            </li>
          )
        })}
      </ul>
      {error && (
        <p className="mt-2 text-[13px] text-today-ink" role="alert">
          {error}
        </p>
      )}
      <div className={FOOT}>
        {unlogged > 0 && (
          <span className="mr-auto text-[13px] text-muted">{m.log_done_unlogged({ count: unlogged })}</span>
        )}
        <Button onClick={onClose}>{m.cancel()}</Button>
        <Button primary disabled={busy} onClick={() => void save()}>
          {m.mark_done()}
        </Button>
      </div>
    </>
  )
}
