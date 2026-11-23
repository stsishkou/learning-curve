import { m } from '@lc/i18n/messages'
import { Button, FIELD, FOOT, INPUT, META, Modal, TITLE } from '@lc/ui'
import { useState, type FormEvent } from 'react'

interface Props {
  open: boolean
  /** Host of the calendar that is connected now; null for none */
  host: string | null
  /** Sets the address, or forgets it when given null. Absent where it cannot be changed. Rejects with the reason */
  onSave?: ((url: string | null) => Promise<void>) | undefined
  onClose: () => void
}

/**
 * Connects the person's own calendar by its secret iCal address, so its busy time shows behind the plan. The
 * address is never shown again once it is saved: only the host it points at.
 */
export function BusyFeedDialog({ open, host, onSave, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(next: string | null) {
    if (!onSave) return
    setBusy(true)
    setError('')
    try {
      await onSave(next)
      setUrl('')
    } catch (err) {
      setError(m.busy_failed({ reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (url.trim()) void save(url.trim())
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <h2 className={TITLE}>{m.busy_calendar()}</h2>
        <p className={META}>{m.busy_hint()}</p>
        {host && (
          <p className="mt-3.5 rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-[14px]">{m.busy_connected({ host })}</p>
        )}
        {onSave && (
          <>
            <label className={`${FIELD} mt-4`}>
              {m.busy_address()}
              <input
                className={INPUT}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <p className="mt-2 text-[12.5px]/[1.5] text-muted">{m.busy_where()}</p>
          </>
        )}
        {error && (
          <p className="mt-2 text-[13px] text-today-ink" role="alert">
            {error}
          </p>
        )}
        <div className={FOOT}>
          {onSave && host && (
            <Button className="mr-auto text-today-ink" disabled={busy} onClick={() => void save(null)}>
              {m.busy_disconnect()}
            </Button>
          )}
          <Button onClick={onClose}>{m.close()}</Button>
          {onSave && (
            <Button primary type="submit" disabled={busy || !url.trim()}>
              {host ? m.busy_replace() : m.busy_connect()}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
