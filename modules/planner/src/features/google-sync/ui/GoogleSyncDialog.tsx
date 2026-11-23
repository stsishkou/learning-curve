import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, toMinsk } from '@lc/plan-domain'
import { Button, FIELD, FOOT, INPUT, META, Modal, TITLE } from '@lc/ui'
import { useState, type SubmitEvent } from 'react'

import type { GoogleSyncStatus } from '../model/source'

interface Props {
  open: boolean
  status: GoogleSyncStatus
  /** Where the browser goes to sign in to Google */
  connectUrl: string
  /** The sign-in that just came back did not work */
  failed: boolean
  /** A round or a call is running */
  working: boolean
  /** Why the last call failed; empty when it did not */
  error: string
  /** Rejects with the reason */
  onSaveClient: (id: string, secret: string) => Promise<void>
  onSync: () => void
  /** Rejects with the reason */
  onDisconnect: () => Promise<void>
  onClose: () => void
}

const NOTE = 'mt-3 text-[13px] text-today-ink'
const moment = (utc: number) => `${fmtDay(toMinsk(utc))} ${hm(toMinsk(utc))}`

/**
 * Connects Google Calendar with the person's own OAuth client and shows how the sync stands: when it last ran,
 * what failed, and the way to run it now or to sign out.
 */
export function GoogleSyncDialog(props: Props) {
  const { open, status, connectUrl, failed, working, error, onSaveClient, onSync, onDisconnect, onClose } = props
  const [id, setId] = useState('')
  const [secret, setSecret] = useState('')
  const [changing, setChanging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  // A failed sign-in is old news once another client is saved.
  const [retried, setRetried] = useState(false)
  const connected = status.connectedAt !== null
  const asking = status.writable && !connected && (!status.configured || changing)

  async function attempt(work: () => Promise<void>) {
    setBusy(true)
    setProblem('')
    try {
      await work()
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!id.trim() || !secret.trim()) return
    void attempt(async () => {
      await onSaveClient(id, secret)
      setId('')
      setSecret('')
      setChanging(false)
      setRetried(true)
    })
  }

  const reason = problem || error || (status.error !== 'reconnect' ? (status.error ?? '') : '')
  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <h2 className={TITLE}>{m.google_calendar()}</h2>
        <p className={META}>{m.google_hint()}</p>
        {!status.writable && <p className="mt-3 text-[13px] text-muted">{m.google_read_only()}</p>}
        {failed && !retried && !connected && (
          <p className={NOTE} role="alert">
            {m.google_connect_failed()}
          </p>
        )}
        {status.error === 'reconnect' && !connected && (
          <p className={NOTE} role="alert">
            {m.google_reconnect()}
          </p>
        )}
        {connected && (
          <div className="mt-3.5 grid gap-0.5 rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-[14px]">
            <p>{m.google_connected({ date: fmtDay(toMinsk(status.connectedAt ?? 0)) })}</p>
            <p className="text-[13px] text-muted">
              {m.google_counts({ calendars: status.calendars, events: status.events })}
            </p>
            <p className="text-[13px] text-muted">
              {working
                ? m.google_syncing()
                : status.lastRound
                  ? m.google_last_sync({ when: moment(status.lastRound) })
                  : m.google_not_synced()}
            </p>
          </div>
        )}
        {asking && (
          <>
            <label className={`${FIELD} mt-4`}>
              {m.google_client_id()}
              <input
                className={INPUT}
                autoComplete="off"
                spellCheck={false}
                placeholder="….apps.googleusercontent.com"
                value={id}
                onChange={(e) => setId(e.target.value)}
              />
            </label>
            <label className={`${FIELD} mt-3`}>
              {m.google_client_secret()}
              <input
                className={INPUT}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </label>
            <p className="mt-2 text-[12.5px]/[1.5] text-muted">{m.google_client_where()}</p>
          </>
        )}
        {reason && (
          <p className={NOTE} role="alert">
            {m.google_failed({ reason })}
          </p>
        )}
        <div className={FOOT}>
          {connected && (
            <Button className="mr-auto text-today-ink" disabled={busy} onClick={() => void attempt(onDisconnect)}>
              {m.google_disconnect()}
            </Button>
          )}
          {status.writable && !connected && status.configured && !changing && (
            <Button className="mr-auto" onClick={() => setChanging(true)}>
              {m.google_other_client()}
            </Button>
          )}
          <Button onClick={onClose}>{m.close()}</Button>
          {connected && (
            <Button primary disabled={working} onClick={onSync}>
              {working ? m.google_syncing() : m.google_sync_now()}
            </Button>
          )}
          {asking && (
            <Button primary type="submit" disabled={busy || !id.trim() || !secret.trim()}>
              {m.google_save_client()}
            </Button>
          )}
          {status.writable && !connected && status.configured && !changing && (
            <a
              className="rounded-[10px] border border-ink bg-ink px-3.5 py-2 font-medium whitespace-nowrap text-bg shadow-card hover:opacity-90"
              href={connectUrl}
            >
              {m.google_connect()}
            </a>
          )}
        </div>
      </form>
    </Modal>
  )
}
