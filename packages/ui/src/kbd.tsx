import type { ReactNode } from 'react'

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-px font-sans text-[11.5px] text-muted">
      {children}
    </kbd>
  )
}
