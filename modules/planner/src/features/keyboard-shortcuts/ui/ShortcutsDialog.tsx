import { m } from '@lc/i18n/messages'
import { Button, FOOT, Kbd, Modal, TITLE } from '@lc/ui'

interface Props {
  open: boolean
  /** Key label and what it does, in the order to show */
  rows: Array<{ keys: string; label: string }>
  onClose: () => void
}

export function ShortcutsDialog({ open, rows, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <h3 className={TITLE}>{m.shortcuts()}</h3>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[14px] md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.keys} className="flex items-center justify-between gap-3 border-b border-line-soft py-1.5">
            <dt>{row.label}</dt>
            <dd>
              <Kbd>{row.keys}</Kbd>
            </dd>
          </div>
        ))}
      </dl>
      <div className={FOOT}>
        <Button onClick={onClose}>{m.close()}</Button>
      </div>
    </Modal>
  )
}
