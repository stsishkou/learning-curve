// Node-only: reads and writes the plan database on disk. Import it from server code and scripts, never from components.
// `PLAN_DATA_DIR` points it at another directory.
import { accessSync, chmodSync, constants, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
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
  parseRevisions,
  purgeTrash,
  recordChange,
  reviseEvents,
  type Plan,
  type PlanChange,
  type PlanEdits,
  type PlanHistory,
  type Revisions,
} from '@lc/plan-domain'

import { bundledPlan } from './bundled'

const DATA_DIR = 'packages/plan-data/data'

/** Looks for the data directory upwards from the working directory, so every package and the built server find it. */
export function dataDir(): string {
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
// Local to a checkout: what the calendars subscribed to the feeds were last given.
const SYNC_FILE = join(dataDir(), 'sync.json')

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'))
const writeJson = (file: string, value: unknown) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)

/** An object read from a file; empty when the file is missing or holds something else. */
function readObject(file: string): Record<string, unknown> {
  const stored = existsSync(file) ? readJson(file) : null
  return typeof stored === 'object' && stored !== null && !Array.isArray(stored) ? { ...stored } : {}
}

/** Settings of this checkout (`data/local.json`), some of them secret: never send them to the browser. */
export const readLocal = () => readObject(LOCAL_FILE)

/** Changes some settings and keeps the others; one given `undefined` is forgotten. Readable by its owner only. */
export function writeLocal(patch: Record<string, unknown>) {
  writeJson(LOCAL_FILE, { ...readLocal(), ...patch })
  chmodSync(LOCAL_FILE, 0o600)
}

/** What the calendars that follow the plan were last given (`data/sync.json`). */
export const readSync = () => readObject(SYNC_FILE)

/** Replaces one part of `data/sync.json`; the file is written whole or not at all. */
export function writeSync(part: string, value: unknown) {
  const temporary = `${SYNC_FILE}.${process.pid}.tmp`
  writeJson(temporary, { ...readSync(), [part]: value })
  renameSync(temporary, SYNC_FILE)
}

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
  const { busyFeed } = readLocal()
  return typeof busyFeed === 'string' ? busyFeed : null
}

export const writeBusyFeed = (url: string | null) => writeLocal({ busyFeed: url ?? undefined })

/** The plan on disk, so edits saved since the last build are visible; the bundled copy when the repo is not around. */
export function readPlan(): Plan {
  if (!existsSync(PLAN_FILE)) return bundledPlan
  const plan = readJson(PLAN_FILE)
  return isPlan(plan) ? plan : bundledPlan
}

const storedRevisions = (sync: Record<string, unknown>): Revisions =>
  parseRevisions(
    typeof sync.feed === 'object' && sync.feed !== null && 'revisions' in sync.feed ? sync.feed.revisions : null,
  )

/**
 * The version of each event in the feeds, brought up to `plan`: a change counts from the first time it is written
 * or served, whichever came first, so a plan changed by `git pull` is counted too. Read-only where nothing can be
 * written, and empty there until something was.
 */
export function feedRevisions(plan: Plan): Revisions {
  const stored = storedRevisions(readSync())
  if (!canWrite()) return stored
  const revised = reviseEvents(stored, plan.events, Date.now())
  if (JSON.stringify(revised) !== JSON.stringify(stored)) writeSync('feed', { revisions: revised })
  return revised
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

/** The plan to write, dated as the one on disk when nothing else in it changed. */
function dated(plan: Plan): Plan {
  if (!existsSync(PLAN_FILE)) return plan
  const stored = readJson(PLAN_FILE)
  if (!isPlan(stored)) return plan
  const kept = { ...plan, meta: { ...plan.meta, generated: stored.meta.generated } }
  return JSON.stringify(kept) === JSON.stringify(stored) ? kept : plan
}

/**
 * Regenerates the schedule, applies `edits` without what has outstayed the trash, and writes both files. The date
 * in the plan moves only with its content, so a save that changes nothing leaves the tracked file as it was.
 */
export function writePlan(edits: PlanEdits): { plan: Plan; orphans: string[]; edits: PlanEdits } {
  const base = buildPlan()
  const kept = purgeTrash(base, edits)
  const result = applyEdits(base, kept)
  const plan = dated(result.plan)
  writeJson(EDITS_FILE, kept)
  writeJson(PLAN_FILE, plan)
  feedRevisions(plan)
  return { ...result, plan, edits: kept }
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
