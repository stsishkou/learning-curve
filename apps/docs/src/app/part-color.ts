import type { CSSProperties } from 'react'

declare module 'react' {
  interface CSSProperties {
    '--part'?: string | undefined
  }
}

/** Sets the part's colour that `text-(--part)` and `border-(--part)` read. */
export const partColor = (color: string): CSSProperties => ({ '--part': color })
