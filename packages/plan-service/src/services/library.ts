import {
  FILE_NAME_MAX,
  fileInfo,
  withVersion,
  type Plan,
  type PlanFileInfo,
  type StoredPlanFile,
  type UserId,
} from '@lc/plan-domain'

import type { Actor } from '../actor'
import type { PlanFailure } from '../failure'
import type { PlanPorts } from '../ports'
import { fail, ok, type Result } from '../result'
import { ownPlace, placeOf } from './place'

/** A plan to keep in the library: a new version of the file `id`, or a new file when no id is given. */
export interface PlanFileSave {
  readonly id?: string | undefined
  readonly name: string
  readonly plan: Plan
  /** What the person wrote about this version */
  readonly note?: string | undefined
}

/**
 * The library of the plan's owner: plan files kept beside the plan, each with its versions. Every method can answer
 * `signed-out` or `not-found` as the plan's own reads do, and `not-found` for a file or a version that is not there.
 * A change answers `forbidden` to a reader, as the owner is on a read-only host.
 */
export interface LibraryService {
  /** Every file, the one saved last first. */
  readonly list: (actor: Actor) => Promise<Result<readonly PlanFileInfo[], PlanFailure>>
  /** The plan of one version of a file; the latest when no version is named. */
  readonly read: (actor: Actor, id: string, version?: string) => Promise<Result<Plan, PlanFailure>>
  /**
   * Keeps a plan as a new version of a file, or as a new file named `plan-<time><3 random characters>`. A plan equal
   * to the latest version adds none.
   */
  readonly save: (actor: Actor, input: PlanFileSave) => Promise<Result<PlanFileInfo, PlanFailure>>
  /** Renames a file: the name is trimmed and cut at 80 characters, and an empty one keeps the old name. */
  readonly rename: (actor: Actor, id: string, name: string) => Promise<Result<PlanFileInfo, PlanFailure>>
  /**
   * Removes one version of a file, or the whole file when no version is named or it is the last one, and answers the
   * files left.
   */
  readonly remove: (actor: Actor, id: string, version?: string) => Promise<Result<readonly PlanFileInfo[], PlanFailure>>
}

const savedAt = (file: PlanFileInfo) => file.versions[0]?.at ?? ''

/** The library service over `ports`. */
export function createLibraryService(ports: PlanPorts): LibraryService {
  async function listed(owner: UserId): Promise<PlanFileInfo[]> {
    const files = await ports.library.list(owner)
    return files.map(fileInfo).toSorted((a, b) => savedAt(b).localeCompare(savedAt(a)))
  }

  async function found(owner: UserId, id: string): Promise<Result<StoredPlanFile, PlanFailure>> {
    const file = await ports.library.get(owner, id)
    return file ? ok(file) : fail({ kind: 'not-found' })
  }

  /** Keeps `file` and answers it as a list shows it. */
  async function kept(owner: UserId, file: StoredPlanFile): Promise<PlanFileInfo> {
    await ports.library.put(owner, file)
    return fileInfo(file)
  }

  return {
    list: async (actor) => {
      const place = await placeOf(ports, actor)
      return place.ok ? ok(await listed(place.value.owner)) : place
    },

    read: async (actor, id, version) => {
      const place = await placeOf(ports, actor)
      if (!place.ok) return place
      const file = await found(place.value.owner, id)
      if (!file.ok) return file
      const { versions } = file.value
      const chosen = version ? versions.find((v) => v.id === version) : versions.at(-1)
      return chosen ? ok(chosen.plan) : fail({ kind: 'not-found' })
    },

    save: async (actor, input) => {
      const place = await ownPlace(ports, actor)
      if (!place.ok) return place
      const { owner } = place.value
      const now = ports.clock.now()
      const file = input.id === undefined ? ok(null) : await found(owner, input.id)
      if (!file.ok) return file
      const id = input.id ?? `plan-${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`
      return ok(await kept(owner, withVersion(file.value, { ...input, id }, now)))
    },

    rename: async (actor, id, name) => {
      const place = await ownPlace(ports, actor)
      if (!place.ok) return place
      const file = await found(place.value.owner, id)
      if (!file.ok) return file
      const named = name.trim().slice(0, FILE_NAME_MAX) || file.value.name
      return ok(await kept(place.value.owner, { ...file.value, name: named }))
    },

    remove: async (actor, id, version) => {
      const place = await ownPlace(ports, actor)
      if (!place.ok) return place
      const { owner } = place.value
      const file = await found(owner, id)
      if (!file.ok) return file
      const left = version ? file.value.versions.filter((v) => v.id !== version) : []
      if (left.length) await ports.library.put(owner, { ...file.value, versions: left })
      else await ports.library.remove(owner, id)
      return ok(await listed(owner))
    },
  }
}
