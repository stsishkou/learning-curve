import { m } from '@lc/i18n/messages'
import { Check, Copy, ExternalLink, FIELD, INPUT } from '@lc/ui'
import { useEffect, useState, type ReactNode } from 'react'

export const NOTE = 'text-[13px]/[1.45] text-today-ink'

/** A page of the app's console, opened beside the planner. */
export function PageLink({ href, children }: { href: string; children: ReactNode }) {
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

/** A value to paste into the app's console, with a button that copies it. */
export function CopyValue({ value }: { value: string }) {
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
        <span aria-live="polite">{copied ? m.sync_copied() : m.sync_copy()}</span>
      </button>
    </span>
  )
}

export function Step({ n, text, children }: { n: number; text: string; children?: ReactNode }) {
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

/** The client's ID and secret, typed or pasted; `onId` may take what is pasted into the ID field whole. */
export function ClientFields({
  id,
  secret,
  placeholder,
  onId,
  onSecret,
}: {
  id: string
  secret: string
  placeholder: string
  onId: (value: string) => void
  onSecret: (value: string) => void
}) {
  return (
    <>
      <label className={`${FIELD} mt-1`}>
        {m.sync_client_id()}
        <input
          className={INPUT}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={id}
          onChange={(e) => onId(e.target.value)}
        />
      </label>
      <label className={FIELD}>
        {m.sync_client_secret()}
        <input
          className={INPUT}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={secret}
          onChange={(e) => onSecret(e.target.value)}
        />
      </label>
      <p className="text-[12.5px] text-muted">{m.sync_client_kept()}</p>
    </>
  )
}

/** The props every app's setup steps take. */
export interface SetupProps {
  /** Where the app's sign-in comes back: the redirect URI the client must list */
  callback: string
  id: string
  secret: string
  onClient: (id: string, secret: string) => void
}
