import { useEffect, useRef, type ReactNode } from 'react'

export const TITLE = 'mb-1 text-[18px]/[1.3] font-semibold'
export const META = 'flex flex-wrap items-center gap-2 text-[13.5px] text-muted'
export const FOOT = 'mt-[18px] flex flex-wrap justify-end gap-2'

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
  }, [open])
  return (
    // A click on the backdrop closes the dialog; the keyboard path is the native Esc handling.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      // m-auto: Tailwind's reset zeroes the margin that centers a modal dialog
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-2xl border border-line bg-surface text-ink shadow-[0_24px_60px_rgb(10_16_30/0.25)] backdrop:bg-[rgb(10_16_30/0.45)]"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="px-[22px] py-5">{children}</div>
    </dialog>
  )
}
