import { useSyncExternalStore } from 'react'

import { Type } from './icons'

// The mode lives on <html> as `data-icons="only"`: the stylesheet hides the words from it, before any script runs.
const KEY = 'lc-icons-only'
const ATTRIBUTE = 'data-icons'

/**
 * Put in the page's <head>: it turns the mode on before the page is drawn, so a page opened in it never shows its
 * words for a moment. The `<html>` it marks then needs `suppressHydrationWarning`.
 */
export const ICONS_ONLY_BOOT = `try{if(localStorage.getItem('${KEY}')==='1')document.documentElement.setAttribute('${ATTRIBUTE}','only')}catch(e){}`

const listeners = new Set<() => void>()

const read = () => document.documentElement.getAttribute(ATTRIBUTE) === 'only'

function apply(on: boolean) {
  if (on) document.documentElement.setAttribute(ATTRIBUTE, 'only')
  else document.documentElement.removeAttribute(ATTRIBUTE)
  for (const listener of listeners) listener()
}

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

// Another tab changed it: this one follows.
const follow = (e: StorageEvent) => {
  if (e.key === KEY || e.key === null) apply(stored())
}

function subscribe(listener: () => void): () => void {
  // A host without the head script (the component stand) still opens in the remembered mode.
  if (listeners.size === 0 && stored() !== read()) apply(stored())
  listeners.add(listener)
  if (listeners.size === 1) window.addEventListener('storage', follow)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', follow)
  }
}

function toggle(): void {
  const on = !read()
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // Storage can be blocked (a private window): the mode then lasts until the page is closed.
  }
  apply(on)
}

const off = () => false

/** Whether buttons with an icon show only the icon, and the switch for it. Kept in the browser, for every page. */
export function useIconsOnly(): [boolean, () => void] {
  return [useSyncExternalStore(subscribe, read, off), toggle]
}

/**
 * The word of a button that has an icon, for a plain `<button>`; `Button` takes `icon` and `label` instead. The
 * button needs `data-label` with the same word: the tooltip shows it while the word is hidden.
 */
export function Label({ children }: { children: string }) {
  return <span className="lc-label">{children}</span>
}

interface ToggleProps {
  /** Accessible name of the switch, e.g. "Icons only" */
  label: string
  /** What it does, after the name in its tooltip */
  hint?: string | undefined
  className?: string | undefined
}

/** The switch of the icons-only mode: pressed while buttons with an icon hide their word. */
export function IconsToggle({ label, hint, className = '' }: ToggleProps) {
  const [on, flip] = useIconsOnly()
  return (
    <button
      type="button"
      className={`grid size-9 flex-none place-items-center rounded-[10px] border border-line bg-surface text-muted shadow-card transition-[background-color,color,transform] duration-150 hover:bg-surface-2 hover:text-ink aria-pressed:border-focus aria-pressed:bg-focus aria-pressed:text-surface motion-safe:active:scale-[0.96] ${className}`}
      aria-pressed={on}
      aria-label={label}
      data-tip={hint ? `${label}. ${hint}` : label}
      onClick={flip}
    >
      <Type size={18} aria-hidden />
    </button>
  )
}
