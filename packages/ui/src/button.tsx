import type { ComponentProps } from 'react'

export function Button({
  primary = false,
  className = '',
  ...props
}: ComponentProps<'button'> & { primary?: boolean }) {
  return (
    <button
      type="button"
      className={`rounded-[10px] border px-3.5 py-2 font-medium shadow-card disabled:opacity-50 ${
        primary ? 'border-ink bg-ink text-bg hover:opacity-90' : 'border-line bg-surface hover:bg-surface-2'
      } ${className}`}
      {...props}
    />
  )
}
