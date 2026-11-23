import { m } from '@lc/i18n/messages'
import { GOOGLE_SCOPE } from '@lc/plan-domain'
import { Check, Copy, ExternalLink, FIELD, INPUT } from '@lc/ui'
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'

import { readClientFile, type ClientFile } from '../model/client-file'

const CONSOLE = 'https://console.cloud.google.com'
/** Google's own pages for each step; the first one makes a project when there is none */
export const CONSOLE_PAGES = {
  api: `${CONSOLE}/flows/enableapi?apiid=calendar-json.googleapis.com`,
  auth: `${CONSOLE}/auth/overview`,
  scope: `${CONSOLE}/auth/scopes`,
  client: `${CONSOLE}/auth/clients`,
}

export const NOTE = 'text-[13px]/[1.45] text-today-ink'

/** A page of Google's console, opened beside the planner. */
export function ConsoleLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-focus hover:underline"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <ExternalLink size={13} aria-hidden />
    </a>
  )
}

/** A value to paste into Google's console, with a button that copies it. */
function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // No clipboard here: the value is selectable as text.
    }
  }

  return (
    <span className="flex min-w-0 items-center gap-2 rounded-lg border border-line-soft bg-surface-2 py-1 pr-1 pl-2.5">
      <code className="min-w-0 flex-1 font-mono text-[12.5px] break-all text-ink select-all">{value}</code>
      <button
        type="button"
        className="flex flex-none items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-muted hover:bg-surface hover:text-ink"
        onClick={() => void copy()}
      >
        {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
        <span aria-live="polite">{copied ? m.google_copied() : m.google_copy()}</span>
      </button>
    </span>
  )
}

function Step({ n, text, children }: { n: number; text: string; children?: ReactNode }) {
  return (
    <li className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-2.5">
      <span
        aria-hidden
        className="grid size-[22px] place-items-center rounded-full bg-surface-2 text-[12px] font-semibold text-muted tabular-nums"
      >
        {n}
      </span>
      <div className="grid min-w-0 gap-1.5 pt-px">
        <p>{text}</p>
        {children}
      </div>
    </li>
  )
}

interface Props {
  /** Where Google's sign-in comes back: the redirect URI the client must list */
  callback: string
  id: string
  secret: string
  onClient: (id: string, secret: string) => void
}

/**
 * The steps that make the person's own OAuth client, each with the page of Google's console it happens on and the
 * value to paste there, then the client itself: the JSON Google offers when it is made, or its ID and secret.
 */
export function GoogleSetup({ callback, id, secret, onClient }: Props) {
  const [loaded, setLoaded] = useState<ClientFile | 'wrong' | null>(null)

  function take(text: string) {
    const file = readClientFile(text)
    setLoaded(file ?? 'wrong')
    if (file) onClient(file.id, file.secret)
  }

  async function load(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Cleared, so choosing the same file again reads it again.
    e.target.value = ''
    if (file) take(await file.text())
  }

  const note =
    loaded === 'wrong'
      ? m.google_file_wrong()
      : loaded?.kind === 'installed'
        ? m.google_file_desktop()
        : loaded && callback && !loaded.redirects.includes(callback)
          ? m.google_file_redirect()
          : ''

  return (
    <ol className="mt-4 grid gap-3.5 text-[13.5px]/[1.45]">
      <Step n={1} text={m.google_step_api()}>
        <span>
          <ConsoleLink href={CONSOLE_PAGES.api}>{m.google_link_api()}</ConsoleLink>
        </span>
      </Step>
      <Step n={2} text={m.google_step_auth()}>
        <span>
          <ConsoleLink href={CONSOLE_PAGES.auth}>{m.google_link_auth()}</ConsoleLink>
        </span>
      </Step>
      <Step n={3} text={m.google_step_scope()}>
        <CopyValue value={GOOGLE_SCOPE} />
        <span>
          <ConsoleLink href={CONSOLE_PAGES.scope}>{m.google_link_scope()}</ConsoleLink>
        </span>
      </Step>
      <Step n={4} text={m.google_step_client()}>
        {callback && <CopyValue value={callback} />}
        <span>
          <ConsoleLink href={CONSOLE_PAGES.client}>{m.google_link_client()}</ConsoleLink>
        </span>
      </Step>
      <Step n={5} text={m.google_step_load()}>
        <label className="inline-flex w-fit cursor-pointer items-center rounded-[10px] border border-line bg-surface px-3.5 py-2 font-medium shadow-card hover:bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-focus">
          {m.google_load_file()}
          <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void load(e)} />
        </label>
        <label className={`${FIELD} mt-1`}>
          {m.google_client_id()}
          <input
            className={INPUT}
            autoComplete="off"
            spellCheck={false}
            placeholder="….apps.googleusercontent.com"
            value={id}
            // The whole JSON pasted here works as well as the file.
            onChange={(e) =>
              e.target.value.trimStart().startsWith('{') ? take(e.target.value) : onClient(e.target.value, secret)
            }
          />
        </label>
        <label className={FIELD}>
          {m.google_client_secret()}
          <input
            className={INPUT}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={secret}
            onChange={(e) => onClient(id, e.target.value)}
          />
        </label>
        <p className="text-[12.5px] text-muted">{m.google_client_kept()}</p>
        {note && (
          <p className={NOTE} role="alert">
            {note}
          </p>
        )}
      </Step>
    </ol>
  )
}
