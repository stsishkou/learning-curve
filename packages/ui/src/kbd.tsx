import type { ReactNode } from 'react'

interface Props {
  /** The key as printed on it, or a combination with spaces between the keys: `⌘ K` */
  children: ReactNode
}

/** A key or a key combination, as shown in the shortcuts list and next to a command. */
export function Kbd({ children }: Props) {
  return (
    <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-px font-sans text-[11.5px] text-muted">
      {children}
    </kbd>
  )
}
