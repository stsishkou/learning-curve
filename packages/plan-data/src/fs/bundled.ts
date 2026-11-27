import { isPlan, type Plan } from '@lc/plan-domain'

import planData from '../../data/plan.json'

function load(): Plan {
  if (!isPlan(planData))
    throw new Error('packages/plan-data/data/plan.json is not a plan; regenerate it with `pnpm run plan`')
  return planData
}

/**
 * The plan that was committed with this build: what a host with no data directory serves. Shared, so a caller that
 * hands it on copies it first.
 */
export const bundledPlan: Plan = load()
