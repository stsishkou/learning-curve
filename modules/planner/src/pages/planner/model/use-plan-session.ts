import {
  applyChange,
  applyEdits,
  editedUids,
  emptyEdits,
  emptyHistory,
  emptyTrash,
  historyEdits,
  historyView,
  recordChange,
  trashOf,
  travel,
  trimHistory,
  type Plan,
  type PlanChange,
  type PlanEdits,
  type PlanHistory,
  type PlanTrash,
  type PlanView,
  type RuleWarning,
} from '@lc/plan-domain'
import { planFileName } from '@lc/plan-domain/ics'
import { previewUpdate } from '@lc/plan-domain/protocol'
import { useCallback, useMemo, useState } from 'react'

import { downloadText } from '../../../shared/lib'

/** The plan on screen with the host's way to change it: the project plan, and each edit, undo and redo goes to the host. */
export interface PlannerPlan {
  /** The plan as the host holds it, with who may change it, which events were edited, the trash and the history */
  view: PlanView
  /** Stores one change. Resolves once `view` is fresh; rejects with the reason. */
  change: (change: PlanChange) => Promise<void>
  /** Stores the changes of an update in order, all or none. Resolves once `view` is fresh. */
  changeAll: (changes: readonly PlanChange[]) => Promise<void>
  /** Moves the plan to a point of its history: 0 is before the first change. Resolves once `view` is fresh. */
  travel: (cursor: number) => Promise<void>
  /** Keeps only the first change and the current one in the history. Resolves once `view` is fresh. */
  trimHistory: () => Promise<void>
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

/**
 * The plan on screen and the one way to change it. Normally that is the project plan and changes go to the host;
 * while a file is open, the file is shown and changes stay in the browser until it is downloaded.
 */
export function usePlanSession({
  view,
  change: onChange,
  changeAll: onChangeAll,
  travel: onTravel,
  trimHistory: onTrimHistory,
}: PlannerPlan) {
  const [file, setFile] = useState<OpenFile | null>(null)
  // Changes on their way to the host, shown at once so a dragged event does not jump back while saving.
  const [pending, setPending] = useState<PlanChange[]>([])
  // True after a change, until the person dismisses the bar that offers to take it back.
  const [justChanged, setJustChanged] = useState(false)
  // The rules the last change broke, for that bar. A done session changed is not one: the person did it on purpose.
  const [warnings, setWarnings] = useState<RuleWarning[]>([])

  const plan = useMemo(() => {
    if (file) return applyEdits(file.base, file.edits).plan
    if (!pending.length) return view.plan
    let edits = emptyEdits()
    for (const change of pending) {
      try {
        edits = applyChange(view.plan, edits, change)
      } catch {
        // A change that cannot be previewed (a restore from the trash) shows up when the host answers.
      }
    }
    return applyEdits(view.plan, edits).plan
  }, [file, pending, view.plan])

  const change = useCallback(
    async (next: PlanChange) => {
      const broken = previewUpdate(plan, [next]).warnings.filter((warning) => warning.rule !== 'done')
      if (file) {
        const edits = applyChange(file.base, file.edits, next)
        const history = recordChange(file.history, applyEdits(file.base, file.edits).plan, next, edits)
        setFile({ ...file, edits, trash: trashOf(file.base, edits), history })
        setWarnings(broken)
        setJustChanged(true)
        return
      }
      setPending((prev) => [...prev, next])
      try {
        await onChange(next)
        setWarnings(broken)
        setJustChanged(true)
      } finally {
        setPending((prev) => prev.filter((other) => other !== next))
      }
    },
    [file, onChange, plan],
  )

  /** Applies the changes of an update in order, each as a step of the history. */
  const changeAll = useCallback(
    async (list: readonly PlanChange[]) => {
      if (file) {
        let { edits, history: steps } = file
        for (const next of list) {
          const before = applyEdits(file.base, edits).plan
          edits = applyChange(file.base, edits, next)
          steps = recordChange(steps, before, next, edits)
        }
        setFile({ ...file, edits, trash: trashOf(file.base, edits), history: steps })
      } else {
        await onChangeAll(list)
      }
      // The dialogs that send several changes showed their warnings before they were applied.
      setWarnings([])
      setJustChanged(true)
    },
    [file, onChangeAll],
  )

  const history = useMemo(() => (file ? historyView(file.history) : view.history), [file, view.history])

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

  const trim = useCallback(async () => {
    if (!file) return onTrimHistory()
    setFile({ ...file, history: trimHistory(file.history) })
  }, [file, onTrimHistory])

  const edited = useMemo(() => new Set(file ? editedUids(file.edits) : view.edited), [file, view.edited])

  return {
    plan,
    /** A file is always editable: its changes never leave the browser. */
    canEdit: file ? true : view.access === 'owner',
    edited,
    trash: file ? file.trash : view.trash,
    change,
    changeAll,
    history,
    travel: go,
    trimHistory: trim,
    /** The step a bar offers to take back right after it was made */
    lastStep: justChanged && history.cursor > 0 ? (history.steps[history.cursor - 1] ?? null) : null,
    /** The rules of the plan that step broke; they stopped nothing */
    lastWarnings: warnings,
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
