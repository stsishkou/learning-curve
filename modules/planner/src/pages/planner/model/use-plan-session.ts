import {
  applyChange,
  applyEdits,
  editedUids,
  emptyEdits,
  type EventPatch,
  type Plan,
  type PlanChange,
  type PlanEdits,
} from '@lc/plan-domain'
import { useCallback, useMemo, useState } from 'react'

import { downloadText } from '../../../shared/lib'

export interface PlannerState {
  plan: Plan
  /** false on a read-only host: the planner then hides its editing controls */
  canEdit: boolean
  /** uids of events that differ from the generated schedule */
  edited: string[]
}

interface OpenFile {
  name: string
  /** The file as it was read */
  base: Plan
  /** What was changed since, kept in the browser only */
  edits: PlanEdits
}

export interface Undo {
  /** Title of the event the last change touched */
  title: string
  run: () => Promise<void>
}

/**
 * The plan on screen and the one way to change it. Normally that is the project plan and changes go to the host;
 * while a file is open, the file is shown and changes stay in the browser until it is downloaded.
 */
export function usePlanSession(state: PlannerState, onChange: (change: PlanChange) => Promise<void>) {
  const [file, setFile] = useState<OpenFile | null>(null)
  // Changes on their way to the host, shown at once so a dragged event does not jump back while saving.
  const [pending, setPending] = useState<PlanChange[]>([])
  const [undo, setUndo] = useState<Undo | null>(null)

  const plan = useMemo(() => {
    if (file) return applyEdits(file.base, file.edits).plan
    if (!pending.length) return state.plan
    let edits = emptyEdits()
    for (const change of pending) {
      try {
        edits = applyChange(state.plan, edits, change)
      } catch {
        // A change that cannot be previewed (a removal) shows up when the host answers.
      }
    }
    return applyEdits(state.plan, edits).plan
  }, [file, pending, state.plan])

  const apply = useCallback(
    async (change: PlanChange) => {
      if (file) {
        setFile({ ...file, edits: applyChange(file.base, file.edits, change) })
        return
      }
      setPending((prev) => [...prev, change])
      try {
        await onChange(change)
      } finally {
        setPending((prev) => prev.filter((other) => other !== change))
      }
    },
    [file, onChange],
  )

  /** Applies a change and remembers how to take it back when it edits an existing event. */
  const change = useCallback(
    async (next: PlanChange) => {
      const event = next.type === 'event.patch' ? plan.events.find((e) => e.uid === next.uid) : undefined
      await apply(next)
      if (next.type !== 'event.patch' || !next.patch || !event) return setUndo(null)
      const before: EventPatch = {}
      for (const key of ['title', 'description', 'start', 'end', 'calendar'] as const) {
        if (key in next.patch) before[key] = event[key]
      }
      if ('done' in next.patch) before.done = !!event.done
      setUndo({
        title: event.title,
        run: async () => {
          setUndo(null)
          await apply({ type: 'event.patch', uid: event.uid, patch: before })
        },
      })
    },
    [apply, plan],
  )

  const edited = useMemo(() => new Set(file ? editedUids(file.edits) : state.edited), [file, state.edited])

  return {
    plan,
    /** A file is always editable: its changes never leave the browser. */
    canEdit: file ? true : state.canEdit,
    edited,
    change,
    undo,
    dismissUndo: () => setUndo(null),
    file: file ? { name: file.name, changes: edited.size + Object.keys(file.edits.calendars).length } : null,
    openFile: (name: string, base: Plan) => (setFile({ name, base, edits: emptyEdits() }), setUndo(null)),
    closeFile: () => (setFile(null), setUndo(null)),
    downloadFile: () => downloadText(file?.name ?? 'plan.json', JSON.stringify(plan, null, 2), 'application/json'),
  }
}
