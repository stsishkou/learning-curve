import {
  canWrite,
  listPlanFiles,
  readPlanVersion,
  removePlanFile,
  renamePlanFile,
  savePlanVersion,
} from '@lc/plan-data'
import { isPlan, type Plan, type PlanFileInfo } from '@lc/plan-domain'
import { createServerFn } from '@tanstack/react-start'

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) throw new Error('An object is required')
  return { ...value }
}
const text = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`)
  return value.trim()
}
const optional = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

const mustWrite = () => {
  if (!canWrite()) throw new Error('The library is read-only here')
}

/** The plan files kept next to the project plan, with their versions. */
export const getPlanFiles = createServerFn({ method: 'GET' }).handler((): PlanFileInfo[] => listPlanFiles())

export const getPlanFile = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    const { id, version } = record(input)
    return { id: text(id, 'id'), version: optional(version) }
  })
  .handler(({ data }): Plan => readPlanVersion(data.id, data.version))

/** Saves a plan as a new version of a file, or as a new file when no id is given. */
export const savePlanFile = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const { id, name, plan, note } = record(input)
    if (!isPlan(plan)) throw new Error('A plan is required')
    return { id: optional(id), name: text(name, 'name'), plan, note: optional(note) }
  })
  .handler(({ data }): PlanFileInfo => {
    mustWrite()
    return savePlanVersion(data)
  })

export const renameSavedPlan = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const { id, name } = record(input)
    return { id: text(id, 'id'), name: text(name, 'name') }
  })
  .handler(({ data }): PlanFileInfo => {
    mustWrite()
    return renamePlanFile(data.id, data.name)
  })

/** Removes one version, or the whole file when no version is named. */
export const removeSavedPlan = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const { id, version } = record(input)
    return { id: text(id, 'id'), version: optional(version) }
  })
  .handler(({ data }): PlanFileInfo[] => {
    mustWrite()
    removePlanFile(data.id, data.version)
    return listPlanFiles()
  })
