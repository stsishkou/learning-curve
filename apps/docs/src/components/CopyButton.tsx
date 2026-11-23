import { Check, Copy } from '@lc/ui'
import { useState } from 'react'

import { useLocale } from '../app/env'
import { m } from '../paraglide/messages'

interface Props {
  /** The text, or a function that reads it at the moment of the click */
  text: string | (() => string)
  className?: string | undefined
}

/** Copies `text` and says so for two seconds, to sighted and screen-reader users alike. */
export function CopyButton({ text, className = '' }: Props) {
  const locale = useLocale()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(typeof text === 'string' ? text : text())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // no clipboard permission: the text stays selectable
    }
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink ${className}`}
      onClick={() => void copy()}
    >
      {copied ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}
      <span aria-live="polite">{copied ? m.copied({}, { locale }) : m.copy({}, { locale })}</span>
    </button>
  )
}
