import { m } from '@lc/i18n/messages'
import { Button } from '@lc/ui'

interface Props {
  name: string
  /** Events changed or added since the file was opened */
  changes: number
  onDownload: () => void
  onClose: () => void
}

/** Stays on screen while a file is shown instead of the project plan. */
export function FileBanner({ name, changes, onDownload, onClose }: Props) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-focus bg-[color-mix(in_srgb,var(--focus)_8%,var(--surface))] px-4 py-2.5 text-[13.5px]"
      role="status"
    >
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{m.file_viewing({ name })}</b>{' '}
        <span className="text-muted">{changes ? m.file_changes({ count: changes }) : m.file_edit_hint()}</span>
      </span>
      <Button primary={changes > 0} onClick={onDownload}>
        {m.file_download()}
      </Button>
      <Button onClick={onClose}>{m.restore_plan()}</Button>
    </div>
  )
}
