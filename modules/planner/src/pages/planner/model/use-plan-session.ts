import { m } from '@lc/i18n/messages'
import {
  applyChange,
  applyEdits,
  editedUids,
  emptyEdits,
  emptyTrash,
  trashOf,
  type EventPatch,
  type Plan,
  type PlanChange,
  type PlanEdits,
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
}

interface OpenFile {
  name: string
  /** The file as it was read */
  base: Plan
  /** What was changed since, kept in the browser only */
  edits: PlanEdits
  trash: PlanTrash
}

export interface Undo {
  /** What the last change did, ready to show */
  label: string
  run: () => Promise<void>
}

/** The change that takes `change` back, with the text of the undo bar; null when there is nothing to take back. */
function inverse(plan: Plan, change: PlanChange): { label: string; change: PlanChange } | null {
  switch (change.type) {
    case 'event.patch': {
      const event = plan.events.find((e) => e.uid === change.uid)
      if (!event || !change.patch) return null
      const before: EventPatch = {}
      for (const key of ['title', 'description', 'start', 'end', 'calendar', 'rrule'] as const) {
        if (key in change.patch) before[key] = event[key]
      }
      if ('done' in change.patch) before.done = !!event.done
      if ('skip' in change.patch) before.skip = event.skip ?? []
      return {
        label: m.changed_event({ title: event.title }),
        change: { type: 'event.patch', uid: event.uid, patch: before },
      }
    }
    case 'event.remove': {
      const event = plan.events.find((e) => e.uid === change.uid)
      return event
        ? { label: m.trashed({ name: event.title }), change: { type: 'trash.restore', events: [event.uid] } }
        : null
    }
    case 'calendar.clear': {
      const calendar = plan.calendars.find((c) => c.id === change.id)
      const events = plan.events.filter((e) => e.calendar === change.id).map((e) => e.uid)
      return calendar && events.length
        ? { label: m.calendar_cleared({ name: calendar.name }), change: { type: 'trash.restore', events } }
        : null
    }
    case 'calendar.remove': {
      const calendar = plan.calendars.find((c) => c.id === change.id)
      return calendar
        ? { label: m.trashed({ name: calendar.name }), change: { type: 'trash.restore', calendars: [calendar.id] } }
        : null
    }
    default:
      return null
  }
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
        const edits = applyChange(file.base, file.edits, change)
        setFile({ ...file, edits, trash: trashOf(file.base, edits) })
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

  /** Applies a change and remembers how to take it back when it edits or removes something. */
  const change = useCallback(
    async (next: PlanChange) => {
      const back = inverse(plan, next)
      await apply(next)
      setUndo(
        back && {
          label: back.label,
          run: async () => {
            setUndo(null)
            await apply(back.change)
          },
        },
      )
    },
    [apply, plan],
  )

  const edited = useMemo(() => new Set(file ? editedUids(file.edits) : state.edited), [file, state.edited])

  return {
    plan,
    /** A file is always editable: its changes never leave the browser. */
    canEdit: file ? true : state.canEdit,
    edited,
    trash: file ? file.trash : state.trash,
    change,
    undo,
    dismissUndo: () => setUndo(null),
    file: file ? { name: file.name, changes: edited.size + Object.keys(file.edits.calendars).length } : null,
    openFile: (name: string, base: Plan) => (
      setFile({ name, base, edits: emptyEdits(), trash: emptyTrash() }),
      setUndo(null)
    ),
    closeFile: () => (setFile(null), setUndo(null)),
    downloadFile: () => downloadText(file?.name ?? 'plan.json', JSON.stringify(plan, null, 2), 'application/json'),
  }
}
