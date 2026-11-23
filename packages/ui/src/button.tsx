import type { ComponentProps, ReactNode } from 'react'

interface Props extends ComponentProps<'button'> {
  /** The one main action of a dialog or a toolbar, filled with the ink color */
  primary?: boolean
  /** An icon before the word: with `label`, the icons-only mode shows only this and moves the word to the tooltip */
  icon?: ReactNode
  /** The button's word, after `icon` and before the children */
  label?: string | undefined
}

/**
 * A `<button>` with the look of the kit. Besides `primary`, `icon` and `label` it accepts every attribute and event
 * handler of a native `<button>` and passes them to the element. No ref is forwarded.
 */
export function Button({ primary = false, icon, label, className = '', children, ...props }: Props) {
  return (
    <button
      type="button"
      className={`rounded-[10px] border px-3.5 py-2 font-medium whitespace-nowrap shadow-card transition-[background-color,border-color,opacity,transform] duration-150 disabled:opacity-50 motion-safe:active:scale-[0.98] motion-safe:disabled:active:scale-100 ${
        primary ? 'border-ink bg-ink text-bg hover:opacity-90' : 'border-line bg-surface hover:bg-surface-2'
      } ${className}`}
      data-label={icon && label ? label : undefined}
      {...props}
    >
      {icon}
      {label !== undefined && <span className="lc-label">{label}</span>}
      {children}
    </button>
  )
}
