import { m } from '@lc/i18n/messages'
import { Button, INPUT } from '@lc/ui'
import { useEffect, useMemo, useRef, useState } from 'react'

const LINE = 20
/** More marks than this would not be told apart on the scrollbar anyway. */
const MAX_MARKS = 400

/** The document as text, with line numbers, a search that jumps between matches and a copy button. */
export function ReaderSource({ text }: { text: string }) {
  const lines = useMemo(() => text.split('\n'), [text])
  const numbers = useMemo(() => lines.map((_line, i) => i + 1).join('\n'), [lines])
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const feedback = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(feedback.current), [])

  const needle = query.trim().toLowerCase()
  const matches = useMemo(
    () => (needle ? lines.flatMap((line, i) => (line.toLowerCase().includes(needle) ? [i] : [])) : []),
    [lines, needle],
  )
  const current = matches.length ? matches[index % matches.length] : null

  function show(next: number) {
    if (!matches.length) return
    const wrapped = (next + matches.length) % matches.length
    setIndex(wrapped)
    const box = scroller.current
    if (box) box.scrollTop = matches[wrapped] * LINE - box.clientHeight / 2
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
          onChange={(e) => (setQuery(e.target.value), setIndex(0))}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            e.preventDefault()
            show(index + (e.shiftKey ? -1 : 1))
          }}
        />
        {needle && (
          <span className="text-[12.5px] text-muted tabular-nums" role="status">
            {matches.length
              ? m.reader_matches({ current: (index % matches.length) + 1, total: matches.length })
              : m.reader_no_matches()}
          </span>
        )}
        <Button aria-label={m.reader_previous_match()} disabled={!matches.length} onClick={() => show(index - 1)}>
          ↑
        </Button>
        <Button aria-label={m.reader_next_match()} disabled={!matches.length} onClick={() => show(index + 1)}>
          ↓
        </Button>
        <Button onClick={() => void copy()}>{m.copy()}</Button>
        {/* Outside the button: a live region inside one is not announced reliably. */}
        <span className={`text-[12.5px] ${copied === 'failed' ? 'text-today-ink' : 'text-done-ink'}`} role="status">
          {copied === 'yes' ? m.copied() : copied === 'failed' ? m.copy_failed() : ''}
        </span>
      </div>

      <div
        ref={scroller}
        className="mt-3 min-h-0 flex-1 overflow-auto rounded-xl border border-line-soft bg-surface-2 font-mono text-[12.5px]/[20px]"
        // A scrolling region without controls inside must be reachable to scroll it from the keyboard.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        <div className="relative grid min-w-max grid-cols-[auto_1fr]">
          {matches.slice(0, MAX_MARKS).map((line) => (
            <div
              key={line}
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 ${line === current ? 'bg-[color-mix(in_srgb,var(--focus)_28%,transparent)]' : 'bg-[color-mix(in_srgb,var(--focus)_10%,transparent)]'}`}
              style={{ top: line * LINE + 10, height: LINE }}
            />
          ))}
          <pre
            aria-hidden
            className="sticky left-0 z-1 border-r border-line-soft bg-surface-2 py-2.5 pr-3 pl-3.5 text-right text-muted select-none"
          >
            {numbers}
          </pre>
          <pre className="relative px-3.5 py-2.5">{text}</pre>
        </div>
      </div>
    </div>
  )
}
