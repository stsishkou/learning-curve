import { canWrite, readEdits, readPlan, writePlan } from '@lc/plan-data'
import { applyChange, buildPlan, editedUids, parseChange, trashOf, type Plan, type PlanTrash } from '@lc/plan-domain'
import { createServerFn } from '@tanstack/react-start'

export interface PlanState {
  plan: Plan
  /** false on a read-only host: the viewer then hides its editing controls */
  canEdit: boolean
  /** uids of events that differ from the generated schedule */
  edited: string[]
  /** Removed events and calendars that can still be restored */
  trash: PlanTrash
}

function state(plan: Plan): PlanState {
  const edits = readEdits()
  return { plan, canEdit: canWrite(), edited: editedUids(edits), trash: trashOf(buildPlan(), edits) }
}

export const getPlanState = createServerFn({ method: 'GET' }).handler((): PlanState => state(readPlan()))

/** Applies one change to data/edits.json and regenerates data/plan.json. */
export const savePlanChange = createServerFn({ method: 'POST' })
  .validator(parseChange)
  .handler(({ data }): PlanState => {
    if (!canWrite()) throw new Error('The plan is read-only here')
    return state(writePlan(applyChange(buildPlan(), readEdits(), data)).plan)
  })
