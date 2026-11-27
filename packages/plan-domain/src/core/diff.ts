import type { Plan, PlanEvent } from './types'

export interface PlanDiff {
  /** In `next` only */
  added: PlanEvent[]
  /** In `base` only */
  removed: PlanEvent[]
  /** Same uid, and something a person would see differs: time, title, calendar, progress, repeats or notes */
  changed: { before: PlanEvent; after: PlanEvent }[]
}

const KEYS = [
  'title',
  'start',
  'end',
  'calendar',
  'allDay',
  'availability',
  'done',
  'actual',
  'unfinished',
  'skipped',
  'rrule',
  'description',
] as const

export type ChangedField = (typeof KEYS)[number] | 'skip'

/** What differs between two versions of an event. `skip` counts as changed when its days do. */
export function changedFields(before: PlanEvent, after: PlanEvent): ChangedField[] {
  const fields: ChangedField[] = KEYS.filter((key) => before[key] !== after[key])
  if ((before.skip ?? []).join() !== (after.skip ?? []).join()) fields.push('skip')
  return fields
}

/** What `next` changes compared with `base`, matched by event uid. */
export function diffPlans(base: Plan, next: Plan): PlanDiff {
  const before = new Map(base.events.map((e) => [e.uid, e]))
  const diff: PlanDiff = { added: [], removed: [], changed: [] }
  for (const after of next.events) {
    const match = before.get(after.uid)
    if (!match) diff.added.push(after)
    else if (changedFields(match, after).length) diff.changed.push({ before: match, after })
    before.delete(after.uid)
  }
  diff.removed = [...before.values()]
  return diff
}
