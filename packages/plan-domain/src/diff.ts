import type { Plan, PlanEvent } from './types'

export interface PlanDiff {
  /** In `next` only */
  added: PlanEvent[]
  /** In `base` only */
  removed: PlanEvent[]
  /** Same uid, different title, time or calendar */
  changed: { before: PlanEvent; after: PlanEvent }[]
}

const KEYS = ['title', 'start', 'end', 'calendar'] as const

/** What `next` changes compared with `base`, matched by event uid. */
export function diffPlans(base: Plan, next: Plan): PlanDiff {
  const before = new Map(base.events.map((e) => [e.uid, e]))
  const diff: PlanDiff = { added: [], removed: [], changed: [] }
  for (const after of next.events) {
    const match = before.get(after.uid)
    if (!match) diff.added.push(after)
    else if (KEYS.some((key) => match[key] !== after[key])) diff.changed.push({ before: match, after })
    before.delete(after.uid)
  }
  diff.removed = [...before.values()]
  return diff
}
