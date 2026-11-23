import { m } from '@lc/i18n/messages'
import { ArrowDown, ArrowUp, Button, Copy, INPUT } from '@lc/ui'
import { useEffect, useRef, useState } from 'react'

import { composing } from '../../../shared/lib'
import type { JsonView } from '../lib/json-view'
import { loadJsonView } from '../lib/load-json-view'

const ICON_BUTTON = 'grid place-items-center px-2.5'

/**
 * The document as text: colored JSON with line numbers, sections that fold, a search that jumps between matches
 * and a copy button. The plain text shows until the editor has loaded.
 */
export function ReaderSource({ text }: { text: string }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [total, setTotal] = useState(0)
  const [ready, setReady] = useState(false)
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<JsonView | null>(null)
  const feedback = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(feedback.current), [])

  useEffect(() => {
    let alive = true
    async function mount() {
      const { mountJsonView } = await loadJsonView()
      if (!alive || !host.current) return
      view.current = mountJsonView(host.current, text, m.reader_tab_source())
      setReady(true)
    }
    void mount()
    return () => {
      alive = false
      view.current?.destroy()
      view.current = null
      setReady(false)
    }
  }, [text])

  const needle = query.trim()
  useEffect(() => {
    if (!ready) return
    setTotal(view.current?.find(needle) ?? 0)
    setIndex(0)
  }, [needle, ready])

  function show(next: number) {
    if (!total) return
    const wrapped = (next + total) % total
    setIndex(wrapped)
    view.current?.show(wrapped)
  }

  async function copy() {
    window.clearTimeout(feedback.current)
    try {
      await navigator.clipboard.writeText(text)
      setCopied('yes')
    } catch {
      setCopied('failed')
    }
    feedback.current = window.setTimeout(() => setCopied(null), 2500)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          className={`${INPUT} min-w-0 flex-1`}
          aria-label={m.reader_find()}
          placeholder={m.reader_find()}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || composing(e)) return
            e.preventDefault()
            show(index + (e.shiftKey ? -1 : 1))
          }}
        />
        {needle && (
          <span className="text-[12.5px] text-muted tabular-nums" role="status">
            {total ? m.reader_matches({ current: index + 1, total }) : m.reader_no_matches()}
          </span>
        )}
        <Button
          className={ICON_BUTTON}
          aria-label={m.reader_previous_match()}
          data-tip={m.reader_previous_match()}
          disabled={!total}
          onClick={() => show(index - 1)}
        >
          <ArrowUp size={16} aria-hidden />
        </Button>
        <Button
          className={ICON_BUTTON}
          aria-label={m.reader_next_match()}
          data-tip={m.reader_next_match()}
          disabled={!total}
          onClick={() => show(index + 1)}
        >
          <ArrowDown size={16} aria-hidden />
        </Button>
        <Button disabled={!ready} onClick={() => view.current?.collapse()}>
          {m.reader_collapse()}
        </Button>
        <Button disabled={!ready} onClick={() => view.current?.expand()}>
          {m.reader_expand()}
        </Button>
        <Button
          className="flex items-center gap-1.5"
          icon={<Copy size={15} aria-hidden />}
          label={m.copy()}
          onClick={() => void copy()}
        />
        {/* Outside the button: a live region inside one is not announced reliably. */}
        <span className={`text-[12.5px] ${copied === 'failed' ? 'text-today-ink' : 'text-done-ink'}`} role="status">
          {copied === 'yes' ? m.copied() : copied === 'failed' ? m.copy_failed() : ''}
        </span>
      </div>

      <div ref={host} className="mt-3 min-h-0 flex-1 overflow-hidden rounded-xl border border-line-soft bg-surface-2">
        {!ready && (
          <pre
            className="h-full overflow-auto px-3.5 py-2.5 font-mono text-[12.5px]/[20px]"
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region without controls must be reachable from the keyboard
            tabIndex={0}
          >
            {text}
          </pre>
        )}
      </div>
    </div>
  )
}
