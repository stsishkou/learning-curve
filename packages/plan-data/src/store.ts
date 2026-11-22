// Node-only: reads and writes the plan database on disk. Import it from server code and scripts, never from components.
// `PLAN_DATA_DIR` points it at another directory.
import { accessSync, constants, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { applyEdits, buildPlan, isPlan, parseEdits, purgeTrash, type Plan, type PlanEdits } from '@lc/plan-domain'

import { bundledPlan } from './bundled'

const DATA_DIR = 'packages/plan-data/data'

/** Looks for the data directory upwards from the working directory, so every package and the built server find it. */
function dataDir(): string {
  if (process.env.PLAN_DATA_DIR) return process.env.PLAN_DATA_DIR
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    const candidate = join(dir, DATA_DIR)
    if (existsSync(candidate) || dirname(dir) === dir) return candidate
  }
}

const PLAN_FILE = join(dataDir(), 'plan.json')
const EDITS_FILE = join(dataDir(), 'edits.json')

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

/** Regenerates the schedule, applies `edits` without what has outstayed the trash, and writes both files. */
export function writePlan(edits: PlanEdits): { plan: Plan; orphans: string[] } {
  const base = buildPlan()
  const kept = purgeTrash(base, edits)
  const result = applyEdits(base, kept)
  writeJson(EDITS_FILE, kept)
  writeJson(PLAN_FILE, result.plan)
  return result
}
