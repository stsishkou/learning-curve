import { m } from '@lc/i18n/messages'
import { Button } from '@lc/ui'
import { useState } from 'react'

interface Props {
  /** Name of the opened file */
  name: string
  /** Events changed or added since the file was opened or saved */
  changes: number
  /** Saves the file with its changes to disk */
  onDownload: () => void
  /** Present when the host keeps plan files: saves the file as a new version there. Rejects with the reason */
  onSave?: (() => Promise<void>) | undefined
  /** Goes back to the project plan */
  onClose: () => void
}

/** Stays on screen while a file is shown instead of the project plan. */
export function FileBanner({ name, changes, onDownload, onSave, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  async function save() {
    if (!onSave) return
    setBusy(true)
    try {
      await onSave()
      setNote({ ok: true, text: m.file_saved() })
    } catch (err) {
      setNote({ ok: false, text: m.save_failed({ reason: err instanceof Error ? err.message : String(err) }) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-focus bg-[color-mix(in_srgb,var(--focus)_8%,var(--surface))] px-4 py-2.5 text-[13.5px]"
      role="status"
    >
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{m.file_viewing({ name })}</b>{' '}
        <span className={note && !note.ok ? 'text-today-ink' : 'text-muted'}>
          {note && (!changes || !note.ok)
            ? note.text
            : changes
              ? m.file_changes({ count: changes })
              : m.file_edit_hint()}
        </span>
      </span>
      {onSave && (
        <Button primary={changes > 0} disabled={busy} onClick={() => void save()}>
          {m.file_save_library()}
        </Button>
      )}
      <Button primary={changes > 0 && !onSave} onClick={onDownload}>
        {m.file_download()}
      </Button>
      <Button onClick={onClose}>{m.restore_plan()}</Button>
    </div>
  )
}
