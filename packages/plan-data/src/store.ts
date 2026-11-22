// Node-only: reads and writes the plan database on disk. Import it from server code and scripts, never from components.
// `PLAN_DATA_DIR` points it at another directory.
import { accessSync, constants, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  applyChange,
  applyEdits,
  buildPlan,
  emptyHistory,
  inSync,
  isPlan,
  parseEdits,
  parseHistory,
  purgeTrash,
  recordChange,
  type Plan,
  type PlanChange,
  type PlanEdits,
  type PlanHistory,
} from '@lc/plan-domain'

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
// Local to a checkout: a record of what was done here, not part of the plan.
const HISTORY_FILE = join(dataDir(), 'history.json')

// Local to a checkout and never committed: it holds a secret address.
const LOCAL_FILE = join(dataDir(), 'local.json')

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'))
const writeJson = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n')

export function readEdits(): PlanEdits {
  return parseEdits(existsSync(EDITS_FILE) ? readJson(EDITS_FILE) : null)
}

export function readHistory(): PlanHistory {
  return parseHistory(existsSync(HISTORY_FILE) ? readJson(HISTORY_FILE) : null)
}

export const writeHistory = (history: PlanHistory) => writeJson(HISTORY_FILE, history)

/**
 * The secret iCal address of the person's own calendar, whose busy time is shown behind the plan. Kept in the
 * untracked `data/local.json`; `BUSY_ICS_URL` sets it on a host that has no writable checkout.
 */
export function readBusyFeed(): string | null {
  if (process.env.BUSY_ICS_URL) return process.env.BUSY_ICS_URL
  if (!existsSync(LOCAL_FILE)) return null
  const local = readJson(LOCAL_FILE)
  return typeof local === 'object' && local !== null && 'busyFeed' in local && typeof local.busyFeed === 'string'
    ? local.busyFeed
    : null
}

export const writeBusyFeed = (url: string | null) => writeJson(LOCAL_FILE, url ? { busyFeed: url } : {})

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
export function writePlan(edits: PlanEdits): { plan: Plan; orphans: string[]; edits: PlanEdits } {
  const base = buildPlan()
  const kept = purgeTrash(base, edits)
  const result = applyEdits(base, kept)
  writeJson(EDITS_FILE, kept)
  writeJson(PLAN_FILE, result.plan)
  return { ...result, edits: kept }
}

/** The stored history, or an empty one starting now when the edits were changed past it. */
export function currentHistory(): PlanHistory {
  const edits = readEdits()
  const history = readHistory()
  return inSync(history, edits) ? history : emptyHistory(edits)
}

/**
 * Stores changes in order, each as a step of the history, and regenerates the plan. All or nothing: when one
 * change does not fit, `applyChange` throws and no file is touched.
 */
export function saveChanges(changes: PlanChange[]): { plan: Plan; edits: PlanEdits } {
  const base = buildPlan()
  let history = currentHistory()
  // Purged first, as `writePlan` would do at the end: the last step then holds exactly the edits on disk.
  let edits = purgeTrash(base, readEdits())
  for (const change of changes) {
    const before = applyEdits(base, edits).plan
    edits = applyChange(base, edits, change)
    history = recordChange(history, before, change, edits)
  }
  const written = writePlan(edits)
  writeHistory(history)
  return written
}
