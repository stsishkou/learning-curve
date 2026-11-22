import { canWrite, readEdits, readPlan, writePlan } from '@lc/plan-data'
import { buildPlan, type EventPatch, parsePatch, patchProblem, type Plan } from '@lc/plan-domain'
import { createServerFn } from '@tanstack/react-start'

export interface PlanState {
  plan: Plan
  /** false on a read-only host: the viewer then hides its editing controls */
  canEdit: boolean
  /** uids of events that differ from the generated schedule */
  edited: string[]
}

const state = (plan: Plan): PlanState => ({ plan, canEdit: canWrite(), edited: Object.keys(readEdits().events) })

export const getPlanState = createServerFn({ method: 'GET' }).handler((): PlanState => state(readPlan()))

interface SaveInput {
  uid: string
  /** null drops the manual changes of this event */
  patch: EventPatch | null
}

function parseSaveInput(input: unknown): SaveInput {
  if (typeof input !== 'object' || input === null || !('uid' in input) || typeof input.uid !== 'string') {
    throw new Error('uid is required')
  }
  const raw = 'patch' in input ? input.patch : null
  if (raw === null) return { uid: input.uid, patch: null }
  const patch = parsePatch(raw)
  if (!patch) throw new Error('patch has a field of the wrong type or format')
  return { uid: input.uid, patch }
}

/** Merges one event's patch into data/edits.json and regenerates data/plan.json. */
export const saveEventEdit = createServerFn({ method: 'POST' })
  .validator(parseSaveInput)
  .handler(({ data }): PlanState => {
    if (!canWrite()) throw new Error('The plan is read-only here')
    const original = buildPlan().events.find((e) => e.uid === data.uid)
    if (!original) throw new Error(`Unknown event "${data.uid}"`)

    const edits = readEdits()
    if (data.patch === null) {
      delete edits.events[data.uid]
    } else {
      const merged: EventPatch = { ...edits.events[data.uid], ...data.patch }
      // Keep only what differs from the generated event, so the file lists real changes.
      for (const key of ['title', 'description', 'start', 'end'] as const) {
        if (merged[key] === original[key]) delete merged[key]
      }
      if (patchProblem(original, merged)) throw new Error('The event must end after it starts')
      if (Object.keys(merged).length) edits.events[data.uid] = merged
      else delete edits.events[data.uid]
    }
    return state(writePlan(edits).plan)
  })
