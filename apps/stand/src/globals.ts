import { isLocale, overwriteGetLocale, type Locale } from '@lc/i18n/runtime'

export type Theme = 'light' | 'dark'

let theme: Theme = 'light'
let locale: Locale = 'ru'
const listeners = new Set<() => void>()

// Components ask Paraglide for the locale on every render. The app answers from the URL; here the toolbar decides.
overwriteGetLocale(() => locale)
document.documentElement.lang = locale

export const getTheme = () => theme
export const getLocale = () => locale

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function set(nextTheme: Theme, nextLocale: Locale) {
  if (nextTheme === theme && nextLocale === locale) return
  theme = nextTheme
  locale = nextLocale
  document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')?.setAttribute('content', theme)
  document.documentElement.lang = locale
  for (const listener of listeners) listener()
  for (const frame of document.querySelectorAll('iframe')) tell(frame)
}

const read = (globals: Record<string, unknown>) =>
  set(globals.theme === 'dark' ? 'dark' : 'light', isLocale(globals.locale) ? globals.locale : 'ru')

let followsPage = false

/**
 * Applies the toolbar choices to the preview document: the theme through the same <meta name="color-scheme">
 * the app pins, the language through Paraglide.
 */
export function applyGlobals(globals: Record<string, unknown>) {
  if (!followsPage) read(globals)
}

// A dialog story on a docs page runs in a frame of its own: a whole preview that the toolbar does not reach.
// The page hands its choices down to those frames, on every change and when a frame asks.
const ANSWER = 'lc-stand:globals'
const QUESTION = 'lc-stand:globals?'

const tell = (frame: HTMLIFrameElement) =>
  frame.contentWindow?.postMessage({ type: ANSWER, theme, locale }, location.origin)

const isAnswer = (data: unknown): data is Record<string, unknown> =>
  typeof data === 'object' && data !== null && 'type' in data && data.type === ANSWER

/**
 * Answers the frames inside this page and, inside a frame, takes the page's choices instead of this preview's own.
 * They are not passed on to Storybook as an update of the globals: every preview posts its events to the window
 * above it, and the page would take that update for one from the toolbar and render again, frames included.
 */
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  const data: unknown = event.data
  if (data === QUESTION) {
    const asking = [...document.querySelectorAll('iframe')].find((frame) => frame.contentWindow === event.source)
    if (asking) tell(asking)
  } else if (isAnswer(data) && event.source === window.parent) {
    followsPage = true
    read(data)
  }
})

let asked = false
/** Asks once, and only when this preview is inside another window. */
export function askPage() {
  if (asked || window.parent === window) return
  asked = true
  window.parent.postMessage(QUESTION, location.origin)
}
