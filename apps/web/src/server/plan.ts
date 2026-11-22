import { canWrite, readEdits, readHistory, readPlan, writeHistory, writePlan } from '@lc/plan-data'
import {
  applyChange,
  applyEdits,
  buildPlan,
  editedUids,
  emptyHistory,
  historyEdits,
  historyView,
  inSync,
  parseChange,
  recordChange,
  trashOf,
  travel,
  type HistoryView,
  type Plan,
  type PlanTrash,
} from '@lc/plan-domain'
import { createServerFn } from '@tanstack/react-start'

export interface PlanState {
  plan: Plan
  /** false on a read-only host: the viewer then hides its editing controls */
  canEdit: boolean
  /** uids of events that differ from the generated schedule */
  edited: string[]
  /** Removed events and calendars that can still be restored */
  trash: PlanTrash
  /** The changes made in this checkout and how many of them are applied */
  history: HistoryView
}

/** The stored history, or an empty one starting now when the edits were changed past it. */
function currentHistory() {
  const edits = readEdits()
  const history = readHistory()
  return inSync(history, edits) ? history : emptyHistory(edits)
}

function state(plan: Plan): PlanState {
  const edits = readEdits()
  return {
    plan,
    canEdit: canWrite(),
    edited: editedUids(edits),
    trash: trashOf(buildPlan(), edits),
    history: historyView(currentHistory()),
  }
}

const mustWrite = () => {
  if (!canWrite()) throw new Error('The plan is read-only here')
}

export const getPlanState = createServerFn({ method: 'GET' }).handler((): PlanState => state(readPlan()))

/** Applies one change to data/edits.json, regenerates data/plan.json and adds the change to the history. */
export const savePlanChange = createServerFn({ method: 'POST' })
  .validator(parseChange)
  .handler(({ data }): PlanState => {
    mustWrite()
    const base = buildPlan()
    const before = readEdits()
    const history = currentHistory()
    const written = writePlan(applyChange(base, before, data))
    writeHistory(recordChange(history, applyEdits(base, before).plan, data, written.edits))
    return state(written.plan)
  })

/** Moves the plan to a point of the history: 0 is before the first change, the number of steps the latest. */
export const travelPlanHistory = createServerFn({ method: 'POST' })
  .validator((cursor: unknown) => {
    if (typeof cursor !== 'number' || !Number.isInteger(cursor) || cursor < 0) throw new Error('A step is required')
    return cursor
  })
  .handler(({ data }): PlanState => {
    mustWrite()
    const history = travel(currentHistory(), data)
    const written = writePlan(historyEdits(history))
    writeHistory(history)
    return state(written.plan)
  })
