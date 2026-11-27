import type { Plan, PlanFileInfo } from '@lc/plan-domain'
import { parseFileRef, parseFileRename, parseFileSave } from '@lc/plan-service'
import { createServerFn } from '@tanstack/react-start'

import { actorOf } from './actor'
import { unwrap } from './respond'
import { services } from './services'

/** The plan files kept next to the project plan, with their versions. */
export const getPlanFiles = createServerFn({ method: 'GET' }).handler(async (): Promise<readonly PlanFileInfo[]> =>
  unwrap(await services.library.list(actorOf())),
)

/** The plan of one version of a file; the latest when no version is named. */
export const getPlanFile = createServerFn({ method: 'GET' })
  .validator(parseFileRef)
  .handler(async ({ data }): Promise<Plan> => unwrap(await services.library.read(actorOf(), data.id, data.version)))

/** Saves a plan as a new version of a file, or as a new file when no id is given. */
export const savePlanFile = createServerFn({ method: 'POST' })
  .validator(parseFileSave)
  .handler(async ({ data }): Promise<PlanFileInfo> => unwrap(await services.library.save(actorOf(), data)))

export const renameSavedPlan = createServerFn({ method: 'POST' })
  .validator(parseFileRename)
  .handler(async ({ data }): Promise<PlanFileInfo> =>
    unwrap(await services.library.rename(actorOf(), data.id, data.name)),
  )

/** Removes one version, or the whole file when no version is named. */
export const removeSavedPlan = createServerFn({ method: 'POST' })
  .validator(parseFileRef)
  .handler(async ({ data }): Promise<readonly PlanFileInfo[]> =>
    unwrap(await services.library.remove(actorOf(), data.id, data.version)),
  )
