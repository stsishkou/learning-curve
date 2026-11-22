// Node-only: reads and writes the plan database on disk. Import it from server code and scripts, never from components.
import { accessSync, constants, existsSync, readFileSync, writeFileSync } from 'node:fs'

import { bundledPlan } from './bundled'
import { applyEdits, parseEdits, type PlanEdits } from './edits'
import { buildPlan } from './schedule'
import { isPlan, type Plan } from './types'

const PLAN_FILE = 'src/data/plan.json'
const EDITS_FILE = 'src/data/edits.json'

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'))
const writeJson = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n')

export function readEdits(): PlanEdits {
  return parseEdits(existsSync(EDITS_FILE) ? readJson(EDITS_FILE) : null)
}

/** The plan on disk, so edits saved since the last build are visible; the bundled copy when the repo is not around. */
export function readPlan(): Plan {
  if (!existsSync(PLAN_FILE)) return bundledPlan
  const plan = readJson(PLAN_FILE)
  return isPlan(plan) ? plan : bundledPlan
}

/** True when the app runs from a writable checkout. `PLAN_READONLY=1` switches editing off, e.g. on a public host. */
export function canWrite(): boolean {
  if (process.env.PLAN_READONLY === '1') return false
  try {
    accessSync(PLAN_FILE, constants.W_OK)
    return true
  } catch {
    return false
  }
}

/** Regenerates the schedule, applies `edits`, and writes both files. */
export function writePlan(edits: PlanEdits): { plan: Plan; orphans: string[] } {
  const result = applyEdits(buildPlan(), edits)
  writeJson(EDITS_FILE, edits)
  writeJson(PLAN_FILE, result.plan)
  return result
}
