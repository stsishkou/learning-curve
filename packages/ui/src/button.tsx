import type { ComponentProps } from 'react'

interface Props extends ComponentProps<'button'> {
  /** The one main action of a dialog or a toolbar, filled with the ink color */
  primary?: boolean
}

/**
 * A `<button>` with the look of the kit. Besides `primary` it accepts every attribute and event handler of a
 * native `<button>` and passes them to the element. No ref is forwarded.
 */
export function Button({ primary = false, className = '', ...props }: Props) {
  return (
    <button
      type="button"
      className={`rounded-[10px] border px-3.5 py-2 font-medium whitespace-nowrap shadow-card transition-[background-color,border-color,opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${
        primary ? 'border-ink bg-ink text-bg hover:opacity-90' : 'border-line bg-surface hover:bg-surface-2'
      } ${className}`}
      {...props}
    />
  )
}
