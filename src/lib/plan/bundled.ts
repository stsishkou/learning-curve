import planData from '#/data/plan.json'
import type { Plan } from './types'

/** Shape check for a plan read from JSON: the bundled database or a file the user opens. */
export function isPlan(value: unknown): value is Plan {
  if (typeof value !== 'object' || value === null) return false
  return (
    'meta' in value &&
    typeof value.meta === 'object' &&
    value.meta !== null &&
    'calendars' in value &&
    Array.isArray(value.calendars) &&
    'events' in value &&
    Array.isArray(value.events)
  )
}

function load(): Plan {
  if (!isPlan(planData)) throw new Error('src/data/plan.json is not a plan; regenerate it with `pnpm run plan`')
  return planData
}

export const bundledPlan = load()
