import { useEffect, useRef } from 'react'

/** Keys are `event.key` in lower case; `mod+k` means Ctrl+K or ⌘K, `mod+shift+z` adds Shift, `shift+f` is a letter with Shift. */
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
      // Shift is part of a letter's key, not of `?` or `+`, which need it on most layouts.
      const shift = e.shiftKey && (mod || /^[a-z]$/i.test(e.key))
      const key = `${mod ? 'mod+' : ''}${shift ? 'shift+' : ''}${e.key.toLowerCase()}`
      const action = latest.current[key]
      if (!action) return
      if (!mod && (typing(e.target) || document.querySelector('dialog[open]'))) return
      // In a text field undo and redo belong to the text.
      if (key.endsWith('+z') && typing(e.target)) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  }, [])
}
