import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { isPlan, parseLocal, type Plan, type PlanChange } from '@lc/plan-domain'
import { Button, META, Modal, Segmented, TITLE } from '@lc/ui'
import { useRef, useState, type DragEvent } from 'react'

import { downloadText } from '../../../shared/lib'
import type { PlanLibrary } from '../model/library'
import { ReaderAssistant } from './ReaderAssistant'
import { ReaderEvents } from './ReaderEvents'
import { ReaderLibrary, type LibraryDoc } from './ReaderLibrary'
import { ReaderOverview } from './ReaderOverview'
import { ReaderSource } from './ReaderSource'

/** A document in the reader: the plan on screen, or a file read from disk. */
interface PlanDoc {
  name: string
  text: string
  /** null when the text is not a plan; the source can still be read */
  plan: Plan | null
  problem: string
  /** false for the plan on screen; true for a file from disk or a version from the library */
  fromDisk: boolean
  /** id of the library file it is a version of */
  origin?: string | undefined
  /** The plan its differences are shown from, when that is not the project plan */
  compare?: { name: string; plan: Plan } | undefined
}

type Tab = 'overview' | 'events' | 'source' | 'files' | 'assistant'

interface Props {
  /** The parent owns it and sets it to false in `onClose` */
  open: boolean
  /** The plan on screen and the name of the file it lives in */
  shown: { name: string; plan: Plan }
  /** The project plan, to compare a file with */
  project: Plan
  /** Opens a file from disk or from the library in the planner, for viewing in the calendar and editing */
  onOpen: (file: { name: string; plan: Plan; origin?: string | undefined }) => void
  /** Present when the host keeps plan files: adds the tab that lists them with their versions */
  library?: PlanLibrary | undefined
  /** id of the library file the plan on screen was opened from */
  origin?: string | undefined
  /** Minsk wall-clock ms, for the brief of the AI chat tab; null before the clock is known */
  now?: number | null | undefined
  /** Stores the changes of an update a chat returned, in order. Absent when the plan cannot be edited */
  onApply?: ((changes: PlanChange[]) => Promise<void>) | undefined
  onClose: () => void
}

const fromLibrary = (file: LibraryDoc): PlanDoc => ({
  name: file.name,
  text: JSON.stringify(file.plan, null, 2),
  plan: file.plan,
  problem: '',
  fromDisk: true,
  origin: file.origin,
  compare: file.compare,
})

async function readDoc(file: File): Promise<PlanDoc> {
  const text = await file.text()
  const doc = { name: file.name, text, fromDisk: true }
  try {
    const plan: unknown = JSON.parse(text)
    if (!isPlan(plan)) return { ...doc, plan: null, problem: m.file_missing_fields() }
    return { ...doc, plan, problem: '' }
  } catch (err) {
    return { ...doc, plan: null, problem: err instanceof Error ? err.message : String(err) }
  }
}

/** Reads a plan file in the browser: what it holds, every event, and the file itself as text. */
export function PlanFileReader({ open, shown, project, onOpen, library, origin, now = null, onApply, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<PlanDoc | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [dropping, setDropping] = useState(false)

  if (!open) {
    return (
      <Modal open={false} size="full" onClose={onClose}>
        {null}
      </Modal>
    )
  }

  const doc: PlanDoc = picked ?? {
    name: shown.name,
    text: JSON.stringify(shown.plan, null, 2),
    plan: shown.plan,
    problem: '',
    fromDisk: false,
  }
  // A file that is not a plan has nothing to list: only its text can be read.
  const active: Tab = tab === 'files' || tab === 'assistant' || doc.plan ? tab : 'source'
  async function load(file: File | undefined) {
    if (!file) return
    setPicked(await readDoc(file))
    setTab('overview')
  }

  function drop(e: DragEvent) {
    e.preventDefault()
    setDropping(false)
    void load(e.dataTransfer.files[0])
  }

  const close = () => (setPicked(null), setTab('overview'), onClose())

  return (
    <Modal open size="full" onClose={close}>
      <div
        className={`flex h-full min-h-0 flex-col rounded-xl ${dropping ? 'outline-2 outline-offset-8 outline-focus outline-dashed' : ''}`}
        onDragOver={(e) => (e.preventDefault(), setDropping(true))}
        onDragLeave={() => setDropping(false)}
        onDrop={drop}
      >
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">
            <h3 className={`${TITLE} truncate`}>{doc.plan?.meta.title || doc.name}</h3>
            <div className={META}>
              {doc.name} ·{' '}
              {m.reader_meta({
                size: Math.max(1, Math.round(doc.text.length / 1024)),
                lines: doc.text.split('\n').length,
              })}
              {doc.plan?.meta.generated
                ? ` · ${m.file_generated({ date: fmtDay(parseLocal(doc.plan.meta.generated)) })}`
                : ''}
            </div>
          </div>
          <Button onClick={() => input.current?.click()}>{m.reader_choose_file()}</Button>
          {picked && <Button onClick={() => (setPicked(null), setTab('overview'))}>{m.reader_back()}</Button>}
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void load(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        {doc.problem && (
          <p className="mt-3 rounded-xl border border-today px-3 py-2 text-[13.5px] text-today-ink" role="alert">
            {m.file_invalid({ reason: doc.problem })}
          </p>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <Segmented
            label={m.view()}
            value={active}
            options={[
              ...(doc.plan
                ? [
                    { value: 'overview' as const, label: m.reader_tab_overview() },
                    { value: 'events' as const, label: m.reader_tab_events() },
                  ]
                : []),
              { value: 'source' as const, label: m.reader_tab_source() },
              ...(library ? [{ value: 'files' as const, label: m.reader_tab_files() }] : []),
              { value: 'assistant' as const, label: m.reader_tab_assistant() },
            ]}
            onChange={setTab}
          />
          <span className="hidden text-[12.5px] text-muted md:inline">{m.reader_drop_hint()}</span>
        </div>

        <div className="mt-3.5 min-h-0 flex-1 overflow-y-auto">
          {active === 'overview' && doc.plan && (
            <ReaderOverview
              plan={doc.plan}
              compareWith={doc.compare?.plan ?? (doc.fromDisk ? project : null)}
              compareName={doc.compare?.name}
            />
          )}
          {active === 'events' && doc.plan && <ReaderEvents plan={doc.plan} />}
          {active === 'source' && <ReaderSource key={doc.name} text={doc.text} />}
          {active === 'files' && library && (
            <ReaderLibrary
              library={library}
              shown={shown}
              origin={origin}
              onView={(file) => (setPicked(fromLibrary(file)), setTab('overview'))}
              onOpen={(file) => (onOpen(file), close())}
            />
          )}
          {active === 'assistant' && <ReaderAssistant plan={shown.plan} now={now} onApply={onApply} />}
        </div>

        <div className="mt-3.5 flex flex-wrap justify-end gap-2">
          <Button className="mr-auto" onClick={() => downloadText(doc.name, doc.text, 'application/json')}>
            {m.file_download()}
          </Button>
          <Button onClick={close}>{m.close()}</Button>
          {doc.fromDisk && doc.plan && (
            <Button
              primary
              onClick={() => {
                const { name, plan } = doc
                if (plan) onOpen({ name, plan, origin: doc.origin })
                close()
              }}
            >
              {m.file_open_in_viewer()}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
