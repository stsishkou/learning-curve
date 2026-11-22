import planData from '#/data/plan.json'

import { isPlan, type Plan } from './types'

function load(): Plan {
  if (!isPlan(planData)) throw new Error('src/data/plan.json is not a plan; regenerate it with `pnpm run plan`')
  return planData
}

export const bundledPlan = load()
