import type { CSSProperties } from 'react'

declare module 'react' {
  interface CSSProperties {
    '--c'?: string
  }
}

/** Sets the calendar color that `bg-cal`, `border-cal` and the `var(--c)` gradients read. */
export const calendarColor = (color: string | undefined): CSSProperties => ({ '--c': color })
