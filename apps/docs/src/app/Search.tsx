import { Search as SearchIcon, X } from '@lc/ui'
import { useEffect, useId, useRef, useState } from 'react'

import { m } from '../paraglide/messages'
import { useDocsEnv } from './env'

// Pagefind indexes the built pages (`pnpm --filter @lc/docs build`) and serves its own script next to them; the index
// it loads follows <html lang>, so each language searches only its own pages.
interface ResultData {
  url: string
  excerpt: string
  meta: { title?: string | undefined }
}
interface Result {
  id: string
  data(): Promise<ResultData>
}
interface Pagefind {
  options(options: { baseUrl: string }): Promise<void>
  debouncedSearch(query: string): Promise<{ results: Result[] } | null>
}

const isPagefind = (value: unknown): value is Pagefind =>
  typeof value === 'object' && value !== null && 'debouncedSearch' in value && 'options' in value

let pagefind: Promise<Pagefind | null> | undefined

function loadPagefind(): Promise<Pagefind | null> {
  pagefind ??= (async () => {
    try {
      const module: unknown = await import(/* @vite-ignore */ `${import.meta.env.BASE_URL}pagefind/pagefind.js`)
      if (!isPagefind(module)) return null
      await module.options({ baseUrl: import.meta.env.BASE_URL })
      return module
    } catch {
      return null
    }
  })()
  return pagefind
}

interface Piece {
  offset: number
  text: string
  marked: boolean
}

/** Pagefind's excerpt is HTML with <mark> around the hits; it is read as text, never inserted as markup. */
function excerptPieces(html: string): Piece[] {
  const body = new DOMParser().parseFromString(html, 'text/html').body
  const pieces: Piece[] = []
  let offset = 0
  for (const node of body.childNodes) {
    const text = node.textContent ?? ''
    pieces.push({ offset, text, marked: node.nodeName === 'MARK' })
    offset += text.length
  }
  return pieces
}

export function Search() {
  const { locale } = useDocsEnv()
  const dialog = useRef<HTMLDialogElement>(null)
  const listId = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResultData[]>([])
  const [state, setState] = useState<'idle' | 'unavailable' | 'done'>('idle')

  useEffect(() => {
    // A newer query aborts this one, so results of an older search never replace newer ones.
    const controller = new AbortController()
    // A call, not a property read: TypeScript would keep a narrowed `aborted` across the awaits below.
    const stale = () => controller.signal.aborted
    if (query.trim()) {
      void (async () => {
        const engine = await loadPagefind()
        if (!engine) {
          if (!stale()) setState('unavailable')
          return
        }
        const found = await engine.debouncedSearch(query)
        if (!found || stale()) return
        const data = await Promise.all(found.results.slice(0, 8).map((result) => result.data()))
        if (stale()) return
        setResults(data)
        setState('done')
      })()
    } else {
      setResults([])
      setState('idle')
    }
    return () => controller.abort()
  }, [query])

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 py-1.5 font-medium text-muted shadow-card hover:bg-surface-2 hover:text-ink"
        onClick={() => dialog.current?.showModal()}
        onPointerEnter={() => void loadPagefind()}
      >
        <SearchIcon aria-hidden size={16} />
        {m.search({}, { locale })}
      </button>
      <dialog
        ref={dialog}
        className="backdrop:bg-black/40 m-auto mt-[10vh] w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl"
        aria-label={m.search({}, { locale })}
        onClose={() => setQuery('')}
      >
        <div className="flex items-center gap-2 border-b border-line p-3">
          <SearchIcon aria-hidden size={18} className="text-muted" />
          <input
            type="search"
            className="min-w-0 flex-1 bg-transparent py-1 text-lg outline-none"
            placeholder={m.search_placeholder({}, { locale })}
            aria-label={m.search_placeholder({}, { locale })}
            aria-controls={listId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="button"
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
            aria-label={m.search_close({}, { locale })}
            onClick={() => dialog.current?.close()}
          >
            <X aria-hidden size={18} />
          </button>
        </div>
        <div id={listId} className="max-h-[60vh] overflow-y-auto p-2" aria-live="polite">
          {state === 'unavailable' && <p className="p-3 text-muted">{m.search_unavailable({}, { locale })}</p>}
          {state === 'done' && results.length === 0 && (
            <p className="p-3 text-muted">{m.search_empty({}, { locale })}</p>
          )}
          {results.length > 0 && (
            <ul aria-label={m.search_results({}, { locale })} className="flex flex-col gap-1">
              {results.map((result) => (
                <li key={result.url}>
                  <a
                    href={result.url}
                    className="flex flex-col gap-1 rounded-lg p-3 hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <span className="font-semibold">{result.meta.title ?? result.url}</span>
                    <span className="text-sm text-muted">
                      {excerptPieces(result.excerpt).map((piece) =>
                        piece.marked ? (
                          <mark key={piece.offset} className="rounded bg-focus/20 px-0.5 text-ink">
                            {piece.text}
                          </mark>
                        ) : (
                          <span key={piece.offset}>{piece.text}</span>
                        ),
                      )}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>
    </>
  )
}
