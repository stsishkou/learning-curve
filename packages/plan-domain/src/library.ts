import { isRecord } from './edits'
import { isPlan, type Plan } from './types'

/** How many versions of one file are kept; the oldest go first. */
export const VERSIONS_KEPT = 30
export const FILE_NAME_MAX = 80

/** One saved state of a plan file, without the plan itself. */
export interface PlanVersion {
  id: string
  /** When it was saved, an ISO instant */
  at: string
  /** What the person wrote about it; empty when nothing */
  note: string
  /** Title of the plan and how many events it had, to tell versions apart in a list */
  title: string
  events: number
}

/** A plan file of the library as a list shows it: its versions, newest first. */
export interface PlanFileInfo {
  id: string
  name: string
  versions: PlanVersion[]
}

/** A plan file as it is stored: every version with its plan, oldest first. */
export interface StoredPlanFile {
  version: 1
  id: string
  name: string
  versions: Array<PlanVersion & { plan: Plan }>
}

export const fileInfo = ({ id, name, versions }: StoredPlanFile): PlanFileInfo => ({
  id,
  name,
  versions: versions.map(({ plan: _plan, ...version }) => version).toReversed(),
})

const cleanName = (name: string) => name.trim().slice(0, FILE_NAME_MAX)

/** Reads a stored file from untrusted input; null when it is not one. */
export function parseStoredFile(value: unknown): StoredPlanFile | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null
  if (!Array.isArray(value.versions)) return null
  const versions = value.versions.flatMap((raw: unknown) => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.at !== 'string' || !isPlan(raw.plan)) return []
    const { plan } = raw
    return [
      {
        id: raw.id,
        at: raw.at,
        note: typeof raw.note === 'string' ? raw.note : '',
        title: plan.meta.title,
        events: plan.events.length,
        plan,
      },
    ]
  })
  return versions.length ? { version: 1, id: value.id, name: cleanName(value.name) || value.id, versions } : null
}

/**
 * The file with one more version: `plan` as it is now. A plan that equals the latest version adds nothing, so
 * saving twice in a row keeps one version. `file` is null for a file that does not exist yet.
 */
export function withVersion(
  file: StoredPlanFile | null,
  save: { id: string; name: string; plan: Plan; note?: string },
  now = Date.now(),
): StoredPlanFile {
  const name = cleanName(save.name) || file?.name || save.plan.meta.title
  const versions = file?.versions ?? []
  const latest = versions.at(-1)
  if (latest && JSON.stringify(latest.plan) === JSON.stringify(save.plan)) return { ...file!, name }
  const at = new Date(now).toISOString()
  const next = {
    id: `v-${now.toString(36)}`,
    at,
    note: (save.note ?? '').trim().slice(0, 200),
    title: save.plan.meta.title,
    events: save.plan.events.length,
    plan: save.plan,
  }
  return { version: 1, id: save.id, name, versions: [...versions, next].slice(-VERSIONS_KEPT) }
}
