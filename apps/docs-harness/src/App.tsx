// A host shaped like the planner where it matters to the remote: React 19.3, the UI kit's tokens on :root, the theme
// switched through <meta name="color-scheme">, shortcuts bound on the window, hostile global CSS, and the remote
// loaded with the runtime API through @lc/docs-host. The Playwright tests in ../tests drive it.
import {
  DOCS_DEFAULT_LOCALE,
  DOCS_LOCALES,
  type DocsLocale,
  type DocsTarget,
  docsPageUrl,
  type FeatureId,
} from '@lc/docs-contract'
import { type DocsEventHandlers, useDocsHost } from '@lc/docs-host'
import { Button, Segmented, useShortcuts } from '@lc/ui'
import { useMemo, useState } from 'react'

type Scheme = 'light' | 'dark'

// Run-time configuration, as the planner gets it from its server: `?remote=` points the same build at any
// deployment of the guide, or at nothing to see the fallback.
const params = new URLSearchParams(globalThis.location.search)
const MANIFEST = params.get('remote') ?? 'http://localhost:4310/remote/v1/mf-manifest.json'
const SITE = params.get('site') ?? 'http://localhost:4310/'
const TIMEOUT = Number(params.get('timeout') ?? 8000)

const TOPIC: FeatureId = 'planner/widgets/week-grid'
const CHAPTER: DocsTarget = { chapterId: 'build-time-microfrontends' }

function setScheme(scheme: Scheme) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')
  if (meta) meta.content = scheme
}

export function App() {
  const [locale, setLocale] = useState<DocsLocale>(DOCS_DEFAULT_LOCALE)
  const [scheme, setSchemeState] = useState<Scheme>('light')
  const [shortcuts, setShortcuts] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const [lastTarget, setLastTarget] = useState<DocsTarget>({ topicId: TOPIC })

  useShortcuts({
    t: () => setShortcuts((count) => count + 1),
    'mod+z': () => setShortcuts((count) => count + 1),
  })

  const events = useMemo<DocsEventHandlers>(() => {
    const write = (line: string) => setLog((lines) => [...lines, line])
    return {
      'docs:ready': ({ version }) => write(`ready ${version}`),
      'docs:open': (target) => write(`open ${JSON.stringify(target)}`),
      'docs:navigate': (target) => write(`navigate ${JSON.stringify(target)}`),
      'docs:close': ({ reason }) => write(`close ${reason}`),
      'docs:language-changed': (detail) => write(`language ${detail.locale}`),
      'docs:error': ({ message }) => write(`error ${message}`),
    }
  }, [])

  const docs = useDocsHost({
    manifestUrl: MANIFEST,
    context: { locale, theme: 'inherit', featureId: TOPIC, siteUrl: SITE },
    events,
    timeoutMs: TIMEOUT,
  })

  const open = (target: DocsTarget) => {
    setLastTarget(target)
    void docs.open(target)
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="font-display text-2xl">Docs remote harness</h1>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<DocsLocale>
          label="Language"
          value={locale}
          options={DOCS_LOCALES.map((value) => ({ value, label: value.toUpperCase() }))}
          onChange={setLocale}
        />
        <Segmented<Scheme>
          label="Theme"
          value={scheme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={(next) => {
            setScheme(next)
            setSchemeState(next)
          }}
        />
        <Button primary onClick={() => open({ topicId: TOPIC })} disabled={docs.status === 'loading'}>
          Docs
        </Button>
        <Button onClick={() => open(CHAPTER)}>Chapter 11</Button>
      </div>

      <p data-testid="status">status: {docs.status}</p>
      {docs.status === 'failed' && (
        <p data-testid="fallback" role="alert">
          The guide could not be loaded ({docs.failure}).{' '}
          <a href={docsPageUrl(SITE, locale, lastTarget)} target="_blank" rel="noreferrer">
            Open it on the site
          </a>
        </p>
      )}

      <p className="lc-card" data-testid="probe">
        A host paragraph with the guide&rsquo;s class names; the guide&rsquo;s stylesheet must not reach it.
      </p>
      <p data-testid="shortcuts">shortcuts: {shortcuts}</p>
      <label className="flex flex-col gap-1">
        Host input
        <input data-testid="host-input" className="rounded-md border border-line bg-surface px-2 py-1" />
      </label>
      <ol data-testid="events" className="font-mono text-sm">
        {log.map((line, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- an append-only log: a line never moves
          <li key={index}>{line}</li>
        ))}
      </ol>
    </main>
  )
}
