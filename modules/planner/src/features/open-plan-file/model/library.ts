import type { Plan, PlanFileInfo } from '@lc/plan-domain'

/** The library of plan files as the host offers it: files kept with their versions, outside the browser. */
export interface PlanLibrary {
  /** Every file, the one saved last first */
  list: () => Promise<PlanFileInfo[]>
  /** The plan of one version; the latest when no version is named */
  read: (id: string, version?: string) => Promise<Plan>
  /** Saves a plan as a new version of the file `id`, or as a new file without one. Rejects with the reason */
  save: (file: { id?: string; name: string; plan: Plan; note?: string }) => Promise<PlanFileInfo>
  rename: (id: string, name: string) => Promise<void>
  /** Removes one version for good, or the whole file when no version is named */
  remove: (id: string, version?: string) => Promise<void>
}
