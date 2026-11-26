import { useEffect, useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react'

export const TITLE = 'mb-1 text-[18px]/[1.3] font-semibold'
export const META = 'flex flex-wrap items-center gap-2 text-[13.5px] text-muted'
// The button row stays in view at the bottom of a dialog that scrolls. It reaches over the padding of the dialog's
// body (22px across, 20px below), so it has to be the body's last element; its top fades in, so that what scrolls
// under it fades out instead of being cut, and a dialog that does not scroll looks as it would without it.
export const FOOT =
  'sticky bottom-0 z-10 -mx-[22px] mt-1.5 -mb-5 flex flex-wrap justify-end gap-2 bg-[linear-gradient(to_bottom,transparent,var(--surface)_12px)] px-[22px] pt-3 pb-5'
// Its mirror at the top, for a heading row that stays in view: the body's first element, reaching over the padding
// above (20px), its lower edge fading.
export const HEAD =
  'sticky top-0 z-10 -mx-[22px] -mt-5 bg-[linear-gradient(to_top,transparent,var(--surface)_12px)] px-[22px] pt-5 pb-3'

interface Props {
  /** The parent owns it: the dialog follows this value and never closes on its own account */
  open: boolean
  /** Called when the person closes the dialog with Esc or a click on the backdrop: set `open` to false here */
  onClose: () => void
  /** Accessible name, when the content has no heading to point at */
  label?: string
  /** `wide` for dialogs that hold a list or a comparison, `full` for a document that fills the window */
  size?: 'normal' | 'wide' | 'full'
  /** Sticks to the top of the window instead of the middle, for a search box whose results change height */
  top?: boolean
  /**
   * Returns the element the dialog is about. On a wide window the dialog then opens beside that element, on the
   * side with more room, and leaves the page behind it readable; without an element it stays in the middle.
   */
  anchor?: (() => Element | null) | undefined
  children: ReactNode
}

/** Below this width a dialog beside its element would cover it anyway. */
export const ANCHOR_FROM = 768
const GAP = 12
const EDGE = 16

/** Puts the dialog beside `target`: right of it when it fits, otherwise left, kept inside the window. */
function placeBeside(dlg: HTMLDialogElement, target: Element | null) {
  if (!target || window.innerWidth < ANCHOR_FROM) {
    dlg.style.margin = dlg.style.left = dlg.style.top = ''
    return
  }
  const at = target.getBoundingClientRect()
  // The layout size, not the box on screen: that one is still scaled down while the dialog grows in.
  const { offsetWidth: width, offsetHeight: height } = dlg
  const right = at.right + GAP
  const left = at.left - GAP - width
  const fits = right + width <= window.innerWidth - EDGE
  const x = fits || left < EDGE ? right : left
  dlg.style.margin = '0'
  dlg.style.left = `${Math.max(EDGE, Math.min(x, window.innerWidth - EDGE - width))}px`
  dlg.style.top = `${Math.max(EDGE, Math.min(at.top, window.innerHeight - EDGE - height))}px`
}

const SIZE = {
  normal: 'w-[min(560px,calc(100vw-32px))]',
  wide: 'w-[min(760px,calc(100vw-32px))]',
  full: 'h-[calc(100dvh-32px)] w-[min(1120px,calc(100vw-32px))]',
}

/**
 * A native `<dialog>` opened with `showModal()`: the page behind it is inert, the focus stays inside, Esc and a
 * click on the backdrop close it. `TITLE`, `META`, `HEAD` and `FOOT`, exported next to it, are the class strings for
 * its heading, the line under the heading, a heading row that stays in view and the button row.
 */
export function Modal({ open, onClose, label, size = 'normal', top = false, anchor, children }: Props) {
  const place = top ? 'mx-auto mt-[12vh] mb-auto' : 'm-auto'
  const backdrop = anchor
    ? 'backdrop:bg-[rgb(10_16_30/0.12)]'
    : 'backdrop:bg-[rgb(10_16_30/0.45)] backdrop:backdrop-blur-[2px]'
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
  }, [open])

  const latestAnchor = useRef(anchor)
  // After every render: the element moves when the event it shows is edited, and the dialog changes height.
  useLayoutEffect(() => {
    latestAnchor.current = anchor
    if (ref.current && open) placeBeside(ref.current, anchor?.() ?? null)
  })
  useEffect(() => {
    const dlg = ref.current
    if (!dlg || !open) return undefined
    const settle = () => placeBeside(dlg, latestAnchor.current?.() ?? null)
    const resized = new ResizeObserver(settle)
    resized.observe(dlg)
    window.addEventListener('resize', settle)
    // Capturing: the page and the panes inside it scroll under an open dialog.
    window.addEventListener('scroll', settle, true)
    return () => {
      resized.disconnect()
      window.removeEventListener('resize', settle)
      window.removeEventListener('scroll', settle, true)
    }
  }, [open])

  // Browsers without `closedby` (Safari) get the backdrop click by hand: a click whose target is the dialog
  // itself and that lands outside its box.
  function backdropClick(e: MouseEvent<HTMLDialogElement>) {
    const dlg = ref.current
    if (!dlg || 'closedBy' in HTMLDialogElement.prototype || e.target !== dlg) return
    const box = dlg.getBoundingClientRect()
    const inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom
    if (!inside) dlg.close()
  }

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the keyboard path is the native Esc; the click covers only the backdrop
    <dialog
      ref={ref}
      // React's types do not know the attribute yet
      {...{ closedby: 'any' }}
      aria-label={label}
      // m-auto / mx-auto: Tailwind's reset zeroes the margin that centers a modal dialog
      className={`lc-layer ${SIZE[size]} ${place} ${backdrop} max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl border border-line bg-surface text-ink shadow-[0_24px_60px_rgb(10_16_30/0.25)]`}
      onClose={onClose}
      onClick={backdropClick}
    >
      <div className={`px-[22px] py-5 ${size === 'full' ? 'h-full' : ''}`}>{children}</div>
    </dialog>
  )
}
