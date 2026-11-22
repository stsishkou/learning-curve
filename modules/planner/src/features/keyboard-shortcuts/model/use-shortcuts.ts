import { useEffect, useRef } from 'react'

/** Keys are `event.key` in lower case; `mod+k` means Ctrl+K or ⌘K. */
export type Shortcuts = Record<string, () => void>

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))

/**
 * Runs page-level shortcuts. Plain keys are ignored while the person types or a dialog is open,
 * so a letter never fires an action by surprise; `mod+…` combinations work everywhere.
 */
export function useShortcuts(shortcuts: Shortcuts) {
  const latest = useRef(shortcuts)
  useEffect(() => {
    latest.current = shortcuts
  })
  useEffect(() => {
    function keyDown(e: KeyboardEvent) {
      if (e.isComposing || e.altKey) return
      const mod = e.ctrlKey || e.metaKey
      const key = `${mod ? 'mod+' : ''}${e.key.toLowerCase()}`
      const action = latest.current[key]
      if (!action) return
      if (!mod && (typing(e.target) || document.querySelector('dialog[open]'))) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  }, [])
}
