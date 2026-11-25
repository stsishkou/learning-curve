// `lc_docs/help`: the module a host loads at run time. It owns everything it puts on the page: one element with a
// shadow root, its React root, its router and its listeners, all created by createDocsHost and removed by destroy().
// Nothing is kept in module scope, so two hosts on one page do not share state.
import {
  DOCS_CONTRACT,
  type DocsContext,
  type DocsEventName,
  type DocsEvents,
  type DocsHelpModule,
  type DocsHost,
  type DocsHostOptions,
  type DocsTarget,
  isChapterId,
} from '@lc/docs-contract'
import { createRoot } from 'react-dom/client'

import { HelpApp } from './HelpApp'
import { createHelpRouter } from './router'
import { adoptStyles } from './shadow'

export const version = DOCS_CONTRACT

type Handlers = { [K in DocsEventName]: Set<(detail: DocsEvents[K]) => void> }

/**
 * Key presses inside the guide stay inside it. They are composed events, so without this the host's shortcuts
 * (bound on the window or the document) would also see a letter typed in the guide, retargeted to <lc-docs>.
 */
const stopAtShadow = (event: Event) => event.stopPropagation()

const TOKENS = ['bg', 'surface', 'surface-2', 'ink', 'muted', 'line', 'focus'] as const

/** `inherit` leaves the scheme and the tokens to the host page; `light`, `dark` and `tokens` override them. */
function applyTheme(element: HTMLElement, context: DocsContext) {
  if (context.theme === 'inherit') element.style.removeProperty('color-scheme')
  else element.style.setProperty('color-scheme', context.theme)
  for (const token of TOKENS) {
    const value = context.tokens?.[token]
    if (value) element.style.setProperty(`--${token}`, value)
    else element.style.removeProperty(`--${token}`)
  }
}

/** The target a path of the drawer's router shows. */
function targetOf(pathname: string, featureId: DocsContext['featureId']): DocsTarget | null {
  const chapterId = /\/chapters\/([\w-]+)\/?$/.exec(pathname)?.[1]
  if (chapterId && isChapterId(chapterId)) return { chapterId }
  return featureId ? { topicId: featureId } : null
}

export function createDocsHost({ context, mount }: DocsHostOptions): DocsHost {
  let current: DocsContext = { ...context }
  let open = false
  let destroyed = false

  const element = document.createElement('lc-docs')
  element.dataset['version'] = DOCS_CONTRACT
  const shadow = element.attachShadow({ mode: 'open' })
  const releaseStyles = adoptStyles(shadow)
  for (const type of ['keydown', 'keyup', 'keypress'] as const) shadow.addEventListener(type, stopAtShadow)
  const container = document.createElement('div')
  shadow.append(container)
  applyTheme(element, current)
  const parent = mount ?? document.body
  parent.append(element)

  const handlers: Handlers = {
    'docs:ready': new Set(),
    'docs:open': new Set(),
    'docs:navigate': new Set(),
    'docs:close': new Set(),
    'docs:language-changed': new Set(),
    'docs:error': new Set(),
  }
  function emit<K extends DocsEventName>(type: K, detail: DocsEvents[K]) {
    const set: Set<(detail: DocsEvents[K]) => void> = handlers[type]
    for (const handler of set) {
      try {
        handler(detail)
      } catch {
        // a host's handler that throws must not break the guide or the other handlers
      }
    }
  }

  const router = createHelpRouter(current.locale)
  const unsubscribe = router.subscribe('onResolved', ({ toLocation }) => {
    const target = targetOf(toLocation.pathname, current.featureId)
    if (target && open) emit('docs:navigate', target)
  })

  const root = createRoot(container)
  function render() {
    root.render(
      <HelpApp
        router={router}
        context={current}
        open={open}
        onClose={() => {
          if (!open) return
          open = false
          render()
          emit('docs:close', { reason: 'user' })
        }}
        onError={(message) => emit('docs:error', { feature: 'help', message })}
      />,
    )
  }
  render()
  // After the caller's synchronous code, so a handler it registers right after creating the host still hears it.
  queueMicrotask(() => {
    if (!destroyed) emit('docs:ready', { version: DOCS_CONTRACT })
  })

  function show(target: DocsTarget) {
    const { locale } = current
    if ('chapterId' in target)
      void router.navigate({ to: '/$locale/chapters/$chapterId/', params: { locale, chapterId: target.chapterId } })
    else {
      current = { ...current, featureId: target.topicId }
      void router.navigate({ to: '/$locale/', params: { locale } })
    }
  }

  return {
    version: DOCS_CONTRACT,
    open(target) {
      if (destroyed) return
      show(target)
      open = true
      render()
      emit('docs:open', target)
    },
    close() {
      if (destroyed || !open) return
      open = false
      render()
      emit('docs:close', { reason: 'host' })
    },
    update(next) {
      if (destroyed) return
      const previous = current.locale
      current = { ...current, ...next }
      applyTheme(element, current)
      if (current.locale !== previous) {
        const { pathname } = router.state.location
        void router.navigate({ href: pathname.replace(`/${previous}/`, `/${current.locale}/`), replace: true })
        emit('docs:language-changed', { locale: current.locale })
      }
      render()
    },
    on(type, handler) {
      const set: Set<typeof handler> = handlers[type]
      set.add(handler)
      return () => {
        set.delete(handler)
      }
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      unsubscribe()
      root.unmount()
      element.remove()
      releaseStyles()
      for (const set of Object.values(handlers)) set.clear()
    },
  }
}

// Checked against the contract here, at the source, rather than trusted at the host.
const helpModule: DocsHelpModule = { version, createDocsHost }
export default helpModule
