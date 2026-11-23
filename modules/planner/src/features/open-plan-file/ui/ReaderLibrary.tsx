import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { FILE_NAME_MAX, hm, toMinsk, type Plan, type PlanFileInfo, type PlanVersion } from '@lc/plan-domain'
import { Button, FIELD, INPUT, Pencil, Trash2 } from '@lc/ui'
import { useEffect, useState, type SubmitEvent } from 'react'

import type { PlanLibrary } from '../model/library'

/** A version picked in the library, ready for the reader. */
export interface LibraryDoc {
  /** id of the file in the library */
  origin: string
  name: string
  plan: Plan
  /** The plan to show the differences from, with what to call it; the plan on screen when left out */
  compare?: { name: string; plan: Plan } | undefined
}

interface Props {
  library: PlanLibrary
  /** The plan on screen: what `Save` stores */
  shown: { name: string; plan: Plan }
  /** id of the library file the plan on screen was opened from, when it was */
  origin?: string | undefined
  /** Shows a version in the reader */
  onView: (doc: LibraryDoc) => void
  /** Opens the latest version of a file in the planner, for editing */
  onOpen: (doc: LibraryDoc) => void
}

const savedAt = (version: PlanVersion) => {
  const t = toMinsk(Date.parse(version.at))
  return `${fmtDay(t)} ${hm(t)}`
}

/**
 * The plan files kept by the host, each with its versions: save the plan on screen as a new file or a new version,
 * look at any version, see what it changed, open a file for editing, rename and delete.
 */
export function ReaderLibrary({ library, shown, origin, onView, onOpen }: Props) {
  const [files, setFiles] = useState<PlanFileInfo[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(shown.plan.meta.title)
  const [note, setNote] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  // What a delete button was pressed on once: the second press deletes.
  const [doomed, setDoomed] = useState('')

  /** Runs one request to the library and reads the list again. */
  async function run(task?: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await task?.()
      setFiles(await library.list())
    } catch (err) {
      setError(m.lib_failed({ reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
      setDoomed('')
    }
  }

  useEffect(() => {
    void run()
    // oxlint-disable-next-line react/exhaustive-deps -- once, when the tab opens
  }, [])

  const save = (id?: string, fileName = name) =>
    run(async () => {
      await library.save({ id, name: fileName, plan: shown.plan, note })
      setNote('')
    })

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (name.trim()) void save()
  }

  const view = (file: PlanFileInfo, version: PlanVersion, againstPrevious: boolean) =>
    run(async () => {
      const plan = await library.read(file.id, version.id)
      const previous = file.versions[file.versions.indexOf(version) + 1]
      const compare =
        againstPrevious && previous
          ? { name: m.lib_previous_version(), plan: await library.read(file.id, previous.id) }
          : undefined
      onView({ origin: file.id, name: file.name, plan, compare })
    })

  const remove = (key: string, id: string, version?: string) =>
    doomed === key ? void run(() => library.remove(id, version)) : setDoomed(key)

  return (
    <div className="grid gap-4">
      <p className="text-[13.5px] text-muted">{m.lib_intro()}</p>

      <form
        className="grid gap-2 rounded-xl bg-surface-2 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
        onSubmit={submit}
      >
        <label className={FIELD}>
          {m.lib_name()}
          <input
            className={`${INPUT} bg-surface`}
            value={name}
            maxLength={FILE_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className={FIELD}>
          {m.lib_note()}
          <input
            className={`${INPUT} bg-surface`}
            value={note}
            maxLength={200}
            placeholder={m.lib_note_placeholder()}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <Button primary type="submit" disabled={busy || !name.trim()}>
          {m.lib_save_new()}
        </Button>
      </form>

      {error && (
        <p className="text-[13px] text-today-ink" role="alert">
          {error}
        </p>
      )}
      {files?.length === 0 && <p className="text-[13.5px] text-muted">{m.lib_empty()}</p>}

      <ul className="grid gap-3">
        {files?.map((file) => (
          <li key={file.id} className="rounded-xl border border-line-soft px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {renaming?.id === file.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const next = renaming.name.trim()
                    setRenaming(null)
                    if (next && next !== file.name) void run(() => library.rename(file.id, next))
                  }}
                >
                  <input
                    className={`${INPUT} min-w-0 flex-1 py-1`}
                    aria-label={m.lib_name()}
                    value={renaming.name}
                    maxLength={FILE_NAME_MAX}
                    // oxlint-disable-next-line jsx-a11y/no-autofocus -- the field replaces the name that was just clicked
                    autoFocus
                    onChange={(e) => setRenaming({ id: file.id, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)}
                  />
                  <Button type="submit">{m.save()}</Button>
                </form>
              ) : (
                <h4 className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                  {file.name}
                  {file.id === origin && (
                    <span className="ml-2 rounded-md border border-current px-[5px] text-[11.5px] font-medium text-focus">
                      {m.lib_on_screen()}
                    </span>
                  )}
                </h4>
              )}
              <Button
                className="grid place-items-center px-2.5"
                disabled={busy}
                aria-label={m.lib_rename({ name: file.name })}
                data-tip={m.lib_rename({ name: file.name })}
                onClick={() => setRenaming({ id: file.id, name: file.name })}
              >
                <Pencil size={15} aria-hidden />
              </Button>
              <Button disabled={busy} onClick={() => void save(file.id, file.name)}>
                {m.lib_save_version()}
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => onOpen({ origin: file.id, name: file.name, plan: await library.read(file.id) }))
                }
              >
                {m.edit()}
              </Button>
              <Button
                className={`grid place-items-center px-2.5 ${doomed === file.id ? 'border-today' : ''} text-today-ink`}
                disabled={busy}
                aria-label={m.lib_delete_file({ name: file.name })}
                data-tip={m.lib_delete_file({ name: file.name })}
                onClick={() => remove(file.id, file.id)}
              >
                {doomed === file.id ? m.lib_delete_sure() : <Trash2 size={15} aria-hidden />}
              </Button>
            </div>
            <ol className="mt-2 grid gap-px text-[13px]">
              {file.versions.map((version, index) => {
                const key = `${file.id}/${version.id}`
                return (
                  <li
                    key={version.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft py-1.5"
                  >
                    <span className="w-[132px] flex-none tabular-nums">{savedAt(version)}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">
                      {index === 0 && <b className="mr-2 font-medium text-ink">{m.lib_latest()}</b>}
                      {version.note || version.title} · {m.lib_events({ count: version.events })}
                    </span>
                    <button
                      type="button"
                      className="text-focus underline-offset-2 hover:underline disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void view(file, version, false)}
                    >
                      {m.lib_view()}
                    </button>
                    {index < file.versions.length - 1 && (
                      <button
                        type="button"
                        className="text-focus underline-offset-2 hover:underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void view(file, version, true)}
                      >
                        {m.lib_changes()}
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-today-ink underline-offset-2 hover:underline disabled:opacity-50"
                      disabled={busy}
                      aria-label={`${m.lib_delete_version()}: ${savedAt(version)}`}
                      onClick={() => remove(key, file.id, version.id)}
                    >
                      {doomed === key ? m.lib_delete_sure() : m.lib_delete_version()}
                    </button>
                  </li>
                )
              })}
            </ol>
          </li>
        ))}
      </ul>
    </div>
  )
}
