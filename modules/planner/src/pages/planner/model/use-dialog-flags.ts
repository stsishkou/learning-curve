import { useState } from 'react'

/**
 * Which of the page's dialogs are open. A set, not one name: dialogs stack (the week review opens catch-up, the
 * command search opens over anything).
 */
export function useDialogFlags<Name extends string>(initial: Name[] = []) {
  const [open, setOpen] = useState<ReadonlySet<Name>>(() => new Set(initial))
  const set = (name: Name, on: boolean) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (on) next.add(name)
      else next.delete(name)
      return next
    })
  return {
    isOpen: (name: Name) => open.has(name),
    show: (name: Name) => set(name, true),
    hide: (name: Name) => set(name, false),
  }
}
