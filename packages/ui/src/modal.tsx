import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'

export const TITLE = 'mb-1 text-[18px]/[1.3] font-semibold'
export const META = 'flex flex-wrap items-center gap-2 text-[13.5px] text-muted'
export const FOOT = 'mt-[18px] flex flex-wrap justify-end gap-2'

interface Props {
  open: boolean
  onClose: () => void
  /** Accessible name, when the content has no heading to point at */
  label?: string
  /** `wide` for dialogs that hold a list or a comparison, `full` for a document that fills the window */
  size?: 'normal' | 'wide' | 'full'
  /** Sticks to the top of the window instead of the middle, for a search box whose results change height */
  top?: boolean
  children: ReactNode
}

const SIZE = {
  normal: 'w-[min(560px,calc(100vw-32px))]',
  wide: 'w-[min(760px,calc(100vw-32px))]',
  full: 'h-[calc(100dvh-32px)] w-[min(1120px,calc(100vw-32px))]',
}

export function Modal({ open, onClose, label, size = 'normal', top = false, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
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
    // The keyboard path is the native Esc handling; the click handler only covers the backdrop.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      // React's types do not know the attribute yet
      {...{ closedby: 'any' }}
      aria-label={label}
      // m-auto / mx-auto: Tailwind's reset zeroes the margin that centers a modal dialog
      className={`${SIZE[size]} ${top ? 'mx-auto mt-[12vh] mb-auto' : 'm-auto'} max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl border border-line bg-surface text-ink shadow-[0_24px_60px_rgb(10_16_30/0.25)] backdrop:bg-[rgb(10_16_30/0.45)] backdrop:backdrop-blur-[2px]`}
      onClose={onClose}
      onClick={backdropClick}
    >
      <div className={`px-[22px] py-5 ${size === 'full' ? 'h-full' : ''}`}>{children}</div>
    </dialog>
  )
}
