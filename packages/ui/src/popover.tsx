import { useEffect, useId, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react'

interface Props {
  /** Accessible name of the trigger and of the panel; the trigger's tooltip too */
  label: string
  /** The trigger's icon */
  icon: ReactNode
  /** The panel's controls */
  children: ReactNode
  /** Extra classes for the trigger button */
  className?: string
}

const TRIGGER =
  'grid size-9 place-items-center rounded-[10px] border border-line bg-surface shadow-card transition-[background-color,transform] duration-150 hover:bg-surface-2 motion-safe:active:scale-[0.96]'

const anchored = () => typeof CSS !== 'undefined' && CSS.supports('position-area: block-end')
const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select, textarea'

/**
 * A button that opens a small panel of controls under itself: choices and switches that change in place, and links
 * or buttons that go somewhere else. Opening it puts the focus on its first control. A press on a choice or a switch
 * (a button with `aria-pressed`) leaves it open, as a switch leaves `Menu` open; any other button or a link closes
 * it, and so do Escape, a click outside and Tab past its last control.
 */
export function Popover({ label, icon, children, className = '' }: Props) {
  const id = useId()
  const anchor = `--popover-${id.replaceAll(/[^a-z0-9]/gi, '')}`
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const element = panel.current
    if (!element) return undefined
    const sync = (e: Event) => {
      const shown = 'newState' in e && e.newState === 'open'
      setOpen(shown)
      if (!shown) return
      // Without anchor positioning the panel is placed by hand, under the trigger and inside the window.
      if (!anchored() && trigger.current) {
        const box = trigger.current.getBoundingClientRect()
        element.style.top = `${box.bottom + 6}px`
        element.style.left = `${Math.max(8, box.right - element.offsetWidth)}px`
      }
      element.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    }
    element.addEventListener('toggle', sync)
    return () => element.removeEventListener('toggle', sync)
  }, [])

  function click(e: MouseEvent<HTMLDivElement>) {
    const pressed = e.target instanceof Element ? e.target.closest('button, a[href]') : null
    if (pressed && !pressed.hasAttribute('aria-pressed')) panel.current?.hidePopover()
  }

  function leave(e: FocusEvent<HTMLDivElement>) {
    const next = e.relatedTarget
    if (next instanceof Node && (panel.current?.contains(next) || trigger.current?.contains(next))) return
    panel.current?.hidePopover()
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`${TRIGGER} ${className}`}
        style={{ anchorName: anchor }}
        aria-label={label}
        data-tip={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        popoverTarget={id}
      >
        {icon}
      </button>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the handlers watch the controls inside: a key presses a control, whose click comes up here */}
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={label}
        // Focusable itself, so a click between its controls keeps the focus inside instead of closing it.
        tabIndex={-1}
        className="lc-layer m-0 min-w-[260px] rounded-xl border border-line bg-surface p-3 text-ink shadow-[0_16px_40px_rgb(10_16_30/0.25)] outline-none"
        style={{
          positionAnchor: anchor,
          inset: 'auto',
          positionArea: 'block-end span-inline-start',
          positionTryFallbacks: 'flip-block, flip-inline',
          marginBlockStart: 6,
        }}
        onClick={click}
        onBlur={leave}
      >
        {children}
      </div>
    </>
  )
}
