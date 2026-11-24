import {
  applyChange,
  applyEdits,
  editedUids,
  emptyEdits,
  emptyHistory,
  emptyTrash,
  historyEdits,
  historyView,
  planFileName,
  recordChange,
  trashOf,
  travel,
  type HistoryView,
  type Plan,
  type PlanChange,
  type PlanEdits,
  type PlanHistory,
  type PlanTrash,
} from '@lc/plan-domain'
import { useCallback, useMemo, useState } from 'react'

import { downloadText } from '../../../shared/lib'

export interface PlannerState {
  plan: Plan
  /** false on a read-only host: the planner then hides its editing controls */
  canEdit: boolean
  /** uids of events that differ from the generated schedule */
  edited: string[]
  /** Removed events and calendars that can still be restored */
  trash: PlanTrash
  /** The changes made so far and how many of them are applied */
  history: HistoryView
}

interface OpenFile {
  name: string
  /** id of the library file it is a version of, when it came from there or was saved there */
  origin?: string | undefined
  /** The file as it was read */
  base: Plan
  /** What was changed since, kept in the browser only */
  edits: PlanEdits
  trash: PlanTrash
  history: PlanHistory
}

interface Host {
  /** Stores one change. Resolves once `state` is fresh; rejects with the reason. */
  onChange: (change: PlanChange) => Promise<void>
  /** Moves the plan to a point of its history. Resolves once `state` is fresh. */
  onTravel: (cursor: number) => Promise<void>
  /** Stores several changes in order, all or none. Without it they are sent one by one */
  onChangeAll?: ((changes: PlanChange[]) => Promise<void>) | undefined
}

/**
 * The plan on screen and the one way to change it. Normally that is the project plan and changes go to the host;
 * while a file is open, the file is shown and changes stay in the browser until it is downloaded.
 */
export function usePlanSession(state: PlannerState, { onChange, onTravel, onChangeAll }: Host) {
  const [file, setFile] = useState<OpenFile | null>(null)
  // Changes on their way to the host, shown at once so a dragged event does not jump back while saving.
  const [pending, setPending] = useState<PlanChange[]>([])
  // True after a change, until the person dismisses the bar that offers to take it back.
  const [justChanged, setJustChanged] = useState(false)

  const plan = useMemo(() => {
    if (file) return applyEdits(file.base, file.edits).plan
    if (!pending.length) return state.plan
    let edits = emptyEdits()
    for (const change of pending) {
      try {
        edits = applyChange(state.plan, edits, change)
      } catch {
        // A change that cannot be previewed (a restore from the trash) shows up when the host answers.
      }
    }
    return applyEdits(state.plan, edits).plan
  }, [file, pending, state.plan])

  const change = useCallback(
    async (next: PlanChange) => {
      if (file) {
        const edits = applyChange(file.base, file.edits, next)
        const history = recordChange(file.history, applyEdits(file.base, file.edits).plan, next, edits)
        setFile({ ...file, edits, trash: trashOf(file.base, edits), history })
        setJustChanged(true)
        return
      }
      setPending((prev) => [...prev, next])
      try {
        await onChange(next)
        setJustChanged(true)
      } finally {
        setPending((prev) => prev.filter((other) => other !== next))
      }
    },
    [file, onChange],
  )

  /** Applies the changes of an update in order, each as a step of the history. */
  const changeAll = useCallback(
    async (list: PlanChange[]) => {
      if (file) {
        let { edits, history: steps } = file
        for (const next of list) {
          const before = applyEdits(file.base, edits).plan
          edits = applyChange(file.base, edits, next)
          steps = recordChange(steps, before, next, edits)
        }
        setFile({ ...file, edits, trash: trashOf(file.base, edits), history: steps })
      } else if (onChangeAll) {
        await onChangeAll(list)
      } else {
        // oxlint-disable-next-line no-await-in-loop -- each change is stored on top of the one before
        for (const next of list) await onChange(next)
      }
      setJustChanged(true)
    },
    [file, onChange, onChangeAll],
  )

  const history = useMemo(() => (file ? historyView(file.history) : state.history), [file, state.history])

  /** Moves the plan back or forward to a point of the history. */
  const go = useCallback(
    async (cursor: number) => {
      setJustChanged(false)
      if (!file) return onTravel(cursor)
      const moved = travel(file.history, cursor)
      const edits = historyEdits(moved)
      setFile({ ...file, edits, trash: trashOf(file.base, edits), history: moved })
    },
    [file, onTravel],
  )

  const edited = useMemo(() => new Set(file ? editedUids(file.edits) : state.edited), [file, state.edited])

  return {
    plan,
    /** A file is always editable: its changes never leave the browser. */
    canEdit: file ? true : state.canEdit,
    edited,
    trash: file ? file.trash : state.trash,
    change,
    changeAll,
    history,
    travel: go,
    /** The step a bar offers to take back right after it was made */
    lastStep: justChanged && history.cursor > 0 ? (history.steps[history.cursor - 1] ?? null) : null,
    dismissLastStep: () => setJustChanged(false),
    file: file
      ? { name: file.name, origin: file.origin, changes: edited.size + Object.keys(file.edits.calendars).length }
      : null,
    openFile: (name: string, base: Plan, origin?: string) => {
      setFile({ name, origin, base, edits: emptyEdits(), trash: emptyTrash(), history: emptyHistory() })
      setJustChanged(false)
    },
    /** The file as it is now was saved to the library as `origin`: what follows is counted from here. */
    fileSaved: (origin: string) => {
      if (file)
        setFile({ ...file, origin, base: plan, edits: emptyEdits(), trash: emptyTrash(), history: emptyHistory() })
      setJustChanged(false)
    },
    closeFile: () => {
      setFile(null)
      setJustChanged(false)
    },
    downloadFile: () =>
      downloadText(file?.name ?? planFileName(plan), JSON.stringify(plan, null, 2), 'application/json'),
  }
}

export type PlanSession = ReturnType<typeof usePlanSession>
