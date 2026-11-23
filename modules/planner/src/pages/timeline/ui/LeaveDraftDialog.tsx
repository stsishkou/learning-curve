import { m } from '@lc/i18n/messages'
import { Button, FOOT, Modal, TITLE } from '@lc/ui'

interface Props {
  open: boolean
  onStay: () => void
  onLeave: () => void
}

/** Asks before a navigation drops a draft that was never applied. */
export function LeaveDraftDialog({ open, onStay, onLeave }: Props) {
  return (
    <Modal open={open} onClose={onStay}>
      <h2 className={TITLE}>{m.timeline_leave_title()}</h2>
      <p className="text-[14px] text-muted">{m.timeline_leave_text()}</p>
      <div className={FOOT}>
        <Button onClick={onLeave}>{m.timeline_leave()}</Button>
        <Button primary onClick={onStay}>
          {m.timeline_stay()}
        </Button>
      </div>
    </Modal>
  )
}
