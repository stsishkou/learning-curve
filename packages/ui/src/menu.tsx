import { EllipsisVertical } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface MenuItem {
  /** React key of the row */
  id: string
  label: string
  /** A 16 px icon before the label; a switch that is on shows its check mark there instead */
  icon?: ReactNode
  /** Shortcut shown at the end of the row */
  keys?: string | undefined
  /** A count or state shown next to the label */
  badge?: ReactNode
  /** Makes the item a switch: it shows a check mark and the menu stays open when it is toggled */
  checked?: boolean | undefined
  /** Dims the row; focus and the arrow keys skip it */
  disabled?: boolean | undefined
  /** Extra classes for the row, e.g. to show it only on a narrow screen */
  className?: string | undefined
  /** Called on a click or Enter; the menu then closes unless the item is a switch */
  run: () => void
}

interface Props {
  /** Accessible name of the trigger and the menu */
  label: string
  /** The rows, top to bottom: `{ id, label, run }` plus the optional `icon`, `keys`, `badge`, `checked`, `disabled`, `className` */
  items: MenuItem[]
  /** The trigger's icon, for a menu of its own in a toolbar; the `⋮` when absent */
  icon?: ReactNode
  /** Extra classes for the trigger button */
  className?: string
  /** Marks the trigger with a dot: something in the menu waits for the person */
  dot?: boolean | undefined
}

const TRIGGER =
  'grid size-9 place-items-center rounded-[10px] border border-line bg-surface text-[18px]/[1] shadow-card transition-[background-color,transform] duration-150 hover:bg-surface-2 motion-safe:active:scale-[0.96]'
const ROW =
  'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] whitespace-nowrap hover:bg-surface-2 focus-visible:bg-surface-2 disabled:opacity-40'

const anchored = () => typeof CSS !== 'undefined' && CSS.supports('position-area: block-end')
const nativeArrows = () => 'focusGroup' in HTMLElement.prototype
// Rows hidden by a breakpoint class are still in the DOM: only the visible ones take focus.
const rowsOf = (menu: HTMLElement) =>
  [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)')].filter(
    (row) => row.offsetParent !== null,
  )

/**
 * A "more actions" button that opens a menu under itself, for the actions that would crowd a toolbar. An item with
 * `checked` is a switch and keeps the menu open. Arrow keys, Home and End move between the rows; Tab, Escape and a
 * click outside close it.
 */
export function Menu({ label, items, icon, className = '', dot = false }: Props) {
  const id = useId()
  const anchor = `--menu-${id.replaceAll(/[^a-z0-9]/gi, '')}`
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
      // Without anchor positioning the menu is placed by hand, under the trigger and inside the window.
      if (!anchored() && trigger.current) {
        const box = trigger.current.getBoundingClientRect()
        element.style.top = `${box.bottom + 6}px`
        element.style.left = `${Math.max(8, box.right - element.offsetWidth)}px`
      }
      rowsOf(element)[0]?.focus()
    }
    element.addEventListener('toggle', sync)
    return () => element.removeEventListener('toggle', sync)
  }, [])

  function keyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Tab leaves the menu instead of being trapped in it.
    if (e.key === 'Tab') return panel.current?.hidePopover()
    if (nativeArrows()) return undefined
    const rows = rowsOf(e.currentTarget)
    const at = rows.findIndex((row) => row === document.activeElement)
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: rows.length - 1 }[e.key]
    if (to === undefined) return undefined
    e.preventDefault()
    e.stopPropagation()
    rows[(to + rows.length) % rows.length]?.focus()
    return undefined
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`relative ${TRIGGER} ${className}`}
        style={{ anchorName: anchor }}
        aria-label={label}
        data-tip={label}
        aria-haspopup="menu"
        aria-expanded={open}
        popoverTarget={id}
      >
        {icon ?? <EllipsisVertical size={18} aria-hidden />}
        {dot && (
          <span
            data-dot
            aria-hidden
            className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-bg bg-today"
          />
        )}
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        className="lc-layer m-0 min-w-[220px] rounded-xl border border-line bg-surface p-1.5 text-ink shadow-[0_16px_40px_rgb(10_16_30/0.25)]"
        style={{
          positionAnchor: anchor,
          inset: 'auto',
          positionArea: 'block-end span-inline-start',
          positionTryFallbacks: 'flip-block, flip-inline',
          marginBlockStart: 6,
        }}
      >
        {/* oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- focus moves between the items, not to the menu itself */}
        <div role="menu" aria-label={label} {...{ focusgroup: 'menu nomemory' }} onKeyDown={keyDown}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={item.checked}
              tabIndex={-1}
              disabled={item.disabled}
              className={`${ROW} ${item.className ?? ''}`}
              onClick={() => {
                item.run()
                if (item.checked === undefined) panel.current?.hidePopover()
              }}
            >
              <span aria-hidden className={`grid w-4 place-items-center ${item.checked ? 'text-focus' : 'text-muted'}`}>
                {item.checked ? '✓' : item.icon}
              </span>
              <span className="min-w-0 flex-1">{item.label}</span>
              {item.badge !== undefined && (
                <em className="text-[12.5px] text-muted not-italic tabular-nums">{item.badge}</em>
              )}
              {item.keys && (
                <kbd className="rounded-md border border-line px-1.5 font-sans text-[11.5px] text-muted">
                  {item.keys}
                </kbd>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
