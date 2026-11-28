import { accessSync, constants, statSync } from 'node:fs'
import { join } from 'node:path'

import { buildPlan } from '@lc/plan-content'
import { isPlan, parseEdits, parseHistory, type Plan, type PlanId, type UserId } from '@lc/plan-domain'
import {
  DEFAULT_PLAN,
  LOCAL_OWNER,
  fail,
  ok,
  type PlanRepository,
  type PlanRevision,
  type PlanSummary,
  type StoredPlan,
} from '@lc/plan-service'

import { bundledPlan } from './bundled'
import { readJsonIfPresent, writeJsonAtomic } from './files'

/** True when the data directory holds a `plan.json` this process may write: the only mark of a writable checkout. */
export function canWritePlan(dir: string): boolean {
  try {
    accessSync(join(dir, 'plan.json'), constants.W_OK)
    return true
  } catch {
    return false
  }
}

const planFiles = (dir: string): readonly string[] =>
  ['plan.json', 'edits.json', 'history.json'].map((name) => join(dir, name))

/** A file's modification time and size, as one string; `-` when it is missing. */
function fileStamp(file: string): string {
  const stat = statSync(file, { bigint: true, throwIfNoEntry: false })
  return stat ? `${stat.mtimeNs}:${stat.size}` : '-'
}

/** The stamps of the three files, as one string. */
const fileRevision = (dir: string): PlanRevision => planFiles(dir).map(fileStamp).join('/')

/**
 * The plan on disk, so edits saved since the last build are visible; the bundled one when none is there. It is parsed
 * once per version of `plan.json` and shared, so a caller that hands it out copies it.
 */
function planReader(dir: string): () => Plan {
  const file = join(dir, 'plan.json')
  let kept: { readonly stamp: string; readonly plan: Plan } | null = null
  return () => {
    // Taken before the file is read: a write in between leaves an old stamp on new content, which costs one more read.
    const stamp = fileStamp(file)
    if (kept?.stamp !== stamp) {
      const plan = readJsonIfPresent(file)
      kept = { stamp, plan: isPlan(plan) ? plan : bundledPlan }
    }
    return kept.plan
  }
}

const owns = (id: PlanId): boolean => id === DEFAULT_PLAN

/**
 * The one plan of a checkout, `DEFAULT_PLAN`, owned by `LOCAL_OWNER`: `edits.json`, `history.json` and `plan.json`
 * in `dir`, over the schedule `buildPlan()` generates. Without a `plan.json` it serves the bundled plan with no edits
 * and no history, and `revision` answers null.
 *
 * Beyond the port: each file is replaced by a rename, so a reader never sees half a file. The revision is the size
 * and modification time of the three files, so it also moves when `pnpm run plan` or the MCP server writes them.
 * The files are written one after another, so a crash between two renames leaves files from two saves, and a writer
 * that starts between the revision check and the first rename is not noticed; both were so before. `plan.json` is
 * parsed again only when its size or modification time moved, so the revision poll, which lists the owner's plans
 * for their title, costs a few `stat` calls.
 */
export function createFsPlans(dir: string): PlanRepository {
  const readPlan = planReader(dir)
  return {
    get: (id) => {
      if (!owns(id)) return Promise.resolve(null)
      // Taken before the files are read: a write in between makes the revision stale, never the content.
      const revision = fileRevision(dir)
      const plan = structuredClone(readPlan())
      const stored: StoredPlan = {
        id,
        owner: LOCAL_OWNER,
        base: buildPlan(),
        edits: parseEdits(readJsonIfPresent(join(dir, 'edits.json'))),
        history: parseHistory(readJsonIfPresent(join(dir, 'history.json'))),
        plan,
        revision,
      }
      return Promise.resolve(stored)
    },
    listOwned: (owner: UserId): Promise<readonly PlanSummary[]> =>
      Promise.resolve(owner === LOCAL_OWNER ? [{ id: DEFAULT_PLAN, title: readPlan().meta.title }] : []),
    revision: (id) => Promise.resolve(owns(id) && canWritePlan(dir) ? fileRevision(dir) : null),
    save: (id, next, expected) => {
      if (!owns(id)) return Promise.reject(new Error('Unknown plan'))
      if (fileRevision(dir) !== expected) return Promise.resolve(fail('conflict'))
      writeJsonAtomic(join(dir, 'edits.json'), next.edits)
      writeJsonAtomic(join(dir, 'plan.json'), next.plan)
      writeJsonAtomic(join(dir, 'history.json'), next.history)
      return Promise.resolve(ok(fileRevision(dir)))
    },
  }
}
