import { isPlan, type Plan } from '@lc/plan-domain'

import planData from '../data/plan.json'

function load(): Plan {
  if (!isPlan(planData))
    throw new Error('packages/plan-data/data/plan.json is not a plan; regenerate it with `pnpm run plan`')
  return planData
}

export const bundledPlan = load()
