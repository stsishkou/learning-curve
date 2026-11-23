// Node-only: the library of plan files, each kept with its versions in `data/library/<id>.json`. The folder is
// local to a checkout and not committed, like the history.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  fileInfo,
  parseStoredFile,
  withVersion,
  type Plan,
  type PlanFileInfo,
  type StoredPlanFile,
} from '@lc/plan-domain'

import { dataDir } from './store'

const dir = () => join(dataDir(), 'library')
// An id becomes a file name: nothing but these characters may reach the disk.
const ID = /^[a-z0-9][a-z0-9-]{0,60}$/
const path = (id: string) => {
  if (!ID.test(id)) throw new Error('Unknown plan file')
  return join(dir(), `${id}.json`)
}

function read(id: string): StoredPlanFile {
  const file = path(id)
  const stored = existsSync(file) ? parseStoredFile(JSON.parse(readFileSync(file, 'utf8'))) : null
  if (!stored) throw new Error('Unknown plan file')
  return stored
}

function write(file: StoredPlanFile): PlanFileInfo {
  mkdirSync(dir(), { recursive: true })
  writeFileSync(path(file.id), JSON.stringify(file, null, 2) + '\n')
  return fileInfo(file)
}

const savedAt = (file: PlanFileInfo) => file.versions[0]?.at ?? ''

/** Every file of the library, the one saved last first. */
export function listPlanFiles(): PlanFileInfo[] {
  if (!existsSync(dir())) return []
  return readdirSync(dir())
    .filter((name) => name.endsWith('.json'))
    .flatMap((name) => {
      try {
        const stored = parseStoredFile(JSON.parse(readFileSync(join(dir(), name), 'utf8')))
        return stored ? [fileInfo(stored)] : []
      } catch {
        return []
      }
    })
    .toSorted((a, b) => savedAt(b).localeCompare(savedAt(a)))
}

/** The plan of one version of a file; the latest when no version is named. */
export function readPlanVersion(id: string, version?: string): Plan {
  const { versions } = read(id)
  const found = version ? versions.find((v) => v.id === version) : versions.at(-1)
  if (!found) throw new Error('Unknown version')
  return found.plan
}

/** Saves `plan` as a new version of the file `id`, or as a new file when no id is given. */
export function savePlanVersion(save: {
  id?: string | undefined
  name: string
  plan: Plan
  note?: string | undefined
}): PlanFileInfo {
  const id = save.id ?? `plan-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
  return write(withVersion(save.id ? read(save.id) : null, { ...save, id }))
}

export function renamePlanFile(id: string, name: string): PlanFileInfo {
  const file = read(id)
  return write({ ...file, name: name.trim().slice(0, 80) || file.name })
}

/** Removes one version of a file, or the whole file when no version is named or it is the last one. */
export function removePlanFile(id: string, version?: string): void {
  const file = read(id)
  const kept = version ? file.versions.filter((v) => v.id !== version) : []
  if (kept.length) write({ ...file, versions: kept })
  else rmSync(path(id))
}
