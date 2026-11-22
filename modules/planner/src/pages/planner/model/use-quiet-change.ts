import { m } from '@lc/i18n/messages'
import type { PlanChange } from '@lc/plan-domain'
import { useState } from 'react'

import { describeStep } from '../../../features/history'
import type { PlanSession } from './use-plan-session'

const errorText = (err: unknown) => m.save_failed({ reason: err instanceof Error ? err.message : String(err) })

/** Changes made outside a dialog (a drag, an undo, a rename): a failure is kept to show above the calendar. */
export function useQuietChange(session: PlanSession) {
  const [saveError, setSaveError] = useState('')
  const quietly = (work: Promise<void>) =>
    void work.then(() => setSaveError('')).catch((err: unknown) => setSaveError(errorText(err)))

  const { cursor, steps } = session.history
  const canUndo = session.canEdit && cursor > 0
  const canRedo = session.canEdit && cursor < steps.length
  return {
    saveError,
    change: (change: PlanChange) => quietly(session.change(change)),
    canUndo,
    canRedo,
    undo: () => canUndo && quietly(session.travel(cursor - 1)),
    redo: () => canRedo && quietly(session.travel(cursor + 1)),
    /** The step a bar offers to take back right after it was made */
    lastStep: session.lastStep && {
      label: describeStep(session.lastStep),
      run: () => session.travel(cursor - 1),
    },
  }
}
