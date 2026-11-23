import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, toMinsk } from '@lc/plan-domain'
import { Button, FOOT, META, Modal, TITLE } from '@lc/ui'
import { useState, useSyncExternalStore, type ReactNode, type SubmitEvent } from 'react'

import type { GoogleSyncStatus, SignInEnd } from '../model/source'
import { CONSOLE_PAGES, ConsoleLink, GoogleSetup, NOTE } from './GoogleSetup'

interface Props {
  open: boolean
  status: GoogleSyncStatus
  /** Where the browser goes to sign in to Google */
  connectUrl: string
  /** Where Google's sign-in comes back, on the address the planner is open at */
  callbackPath: string
  /** How the sign-in that just came back ended; null when none did */
  ended: SignInEnd | null
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

const moment = (utc: number) => `${fmtDay(toMinsk(utc))} ${hm(toMinsk(utc))}`
const CONNECT =
  'rounded-[10px] border border-ink bg-ink px-3.5 py-2 font-medium whitespace-nowrap text-bg shadow-card hover:opacity-90'
// The page's own address is known only in the browser, and does not change while the page is open.
function subscribe() {
  return () => {
    // nothing to stop listening to
  }
}
const useOrigin = () =>
  useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => '',
  )

/** What went wrong, in words that say what to do about it. */
function problemNote(code: string, connectUrl: string): { text: ReactNode; quiet?: boolean } {
  switch (code) {
    case 'reconnect':
      return { text: m.google_reconnect() }
    case 'client':
      return { text: m.google_problem_client() }
    case 'denied':
      return { text: m.google_denied() }
    case 'failed':
      return { text: m.google_connect_failed() }
    case 'offline':
      return { text: m.google_problem_offline(), quiet: true }
    case 'api-off':
      return {
        text: (
          <>
            {m.google_problem_api()} <ConsoleLink href={CONSOLE_PAGES.api}>{m.google_turn_on()}</ConsoleLink>
          </>
        ),
      }
    case 'scope':
      return {
        text: (
          <>
            {m.google_problem_scope()}{' '}
            <a className="font-medium text-focus hover:underline" href={connectUrl}>
              {m.google_connect()}
            </a>
          </>
        ),
      }
    default:
      return { text: m.google_failed({ reason: code }) }
  }
}

/**
 * Connects Google Calendar with the person's own OAuth client and shows how the sync stands. Without a client it walks
 * through making one, each step with its page of Google's console and the value to paste there; saving the client goes
 * straight on to Google's sign-in.
 */
export function GoogleSyncDialog(props: Props) {
  const { open, status, connectUrl, callbackPath, ended, working, error, onSaveClient, onSync, onDisconnect, onClose } =
    props
  const origin = useOrigin()
  const [id, setId] = useState('')
  const [secret, setSecret] = useState('')
  const [changing, setChanging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  // How the last sign-in ended is old news once another client is saved.
  const [retried, setRetried] = useState(false)
  const connected = status.connectedAt !== null
  const asking = status.writable && !connected && (!status.configured || changing)
  const ready = status.writable && !connected && status.configured && !changing

  async function attempt(work: () => Promise<void>) {
    setBusy(true)
    setFailure('')
    try {
      await work()
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!id.trim() || !secret.trim()) return
    void attempt(async () => {
      await onSaveClient(id, secret)
      setRetried(true)
      window.location.assign(connectUrl)
    })
  }

  const signIn = ended && ended !== 'connected' && !connected && !retried ? ended : null
  const round = status.error === 'reconnect' && connected ? null : status.error
  const code = failure || error ? 'call' : (signIn ?? round)
  const note =
    code === 'call' ? { text: m.google_failed({ reason: failure || error }) } : code && problemNote(code, connectUrl)

  return (
    <Modal open={open} onClose={onClose} size={asking ? 'wide' : 'normal'}>
      <form onSubmit={submit}>
        <h2 className={TITLE}>{m.google_calendar()}</h2>
        <p className={META}>{asking ? m.google_setup_hint() : m.google_hint()}</p>
        {!status.writable && <p className="mt-3 text-[13px] text-muted">{m.google_read_only()}</p>}
        {asking && (
          <GoogleSetup
            callback={origin && `${origin}${callbackPath}`}
            id={id}
            secret={secret}
            onClient={(nextId, nextSecret) => {
              setId(nextId)
              setSecret(nextSecret)
            }}
          />
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
        {note && (
          <p className={`mt-3 ${note.quiet ? 'text-[13px]/[1.45] text-muted' : NOTE}`} role="alert">
            {note.text}
          </p>
        )}
        <div className={FOOT}>
          {connected && (
            <Button className="mr-auto text-today-ink" disabled={busy} onClick={() => void attempt(onDisconnect)}>
              {m.google_disconnect()}
            </Button>
          )}
          {ready && (
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
              {m.google_save_connect()}
            </Button>
          )}
          {ready && (
            <a className={CONNECT} href={connectUrl}>
              {m.google_connect()}
            </a>
          )}
        </div>
      </form>
    </Modal>
  )
}
