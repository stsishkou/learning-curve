import { feedAddress, type BusyBlock, type PlanAccess } from '@lc/plan-domain'

import type { Actor } from '../actor'
import type { PlanFailure } from '../failure'
import type { BusyFeedSetting, PlanPorts } from '../ports'
import { fail, ok, type Result } from '../result'
import { ownPlace, placeOf } from './place'

/** The busy-calendar address as the page may know it: the address itself is a secret and stays on the server. */
export interface BusyFeed {
  /** Host of the calendar address that is set, null when none is */
  readonly host: string | null
  /** false where the address cannot be changed: a read-only host, or one that sets it with `BUSY_ICS_URL` */
  readonly canSet: boolean
}

/**
 * The busy time of the plan owner's own calendar, shown behind the plan. Every method can answer `signed-out` or
 * `not-found` as the plan's own reads do.
 */
export interface BusyService {
  /** Whether an address is set, and whether the actor may change it. */
  readonly feed: (actor: Actor) => Promise<Result<BusyFeed, PlanFailure>>
  /**
   * Keeps the address after reading it once, fresh, or forgets it when given null. Answers `forbidden` to a reader,
   * as the owner is on a read-only host, and where the host fixes the address. Rejects with the reader's error,
   * keeping nothing, when the address does not answer with a calendar.
   */
  readonly setFeed: (actor: Actor, url: string | null) => Promise<Result<BusyFeed, PlanFailure>>
  /**
   * The busy blocks between two Minsk wall-clock moments; none when no address is set. Rejects with the reader's
   * error when the address does not answer.
   */
  readonly blocks: (actor: Actor, from: number, to: number) => Promise<Result<readonly BusyBlock[], PlanFailure>>
}

const addressOf = (setting: BusyFeedSetting) => feedAddress(setting.url ?? '')

const feedOf = (setting: BusyFeedSetting, access: PlanAccess): BusyFeed => {
  const url = addressOf(setting)
  return { host: url ? new URL(url).host : null, canSet: access === 'owner' && !setting.fixed }
}

/** The busy service over `ports`. */
export function createBusyService(ports: PlanPorts): BusyService {
  return {
    feed: async (actor) => {
      const place = await placeOf(ports, actor)
      if (!place.ok) return place
      return ok(feedOf(await ports.settings.busyFeed(place.value.owner), place.value.access))
    },

    setFeed: async (actor, url) => {
      const place = await ownPlace(ports, actor)
      if (!place.ok) return place
      const { owner, access } = place.value
      const setting = await ports.settings.busyFeed(owner)
      if (setting.fixed) return fail({ kind: 'forbidden' })
      if (url !== null) await ports.busy.read(url, 0, 0, true)
      await ports.settings.setBusyFeed(owner, url)
      return ok(feedOf(await ports.settings.busyFeed(owner), access))
    },

    blocks: async (actor, from, to) => {
      const place = await placeOf(ports, actor)
      if (!place.ok) return place
      const url = addressOf(await ports.settings.busyFeed(place.value.owner))
      return ok(url ? await ports.busy.read(url, from, to) : [])
    },
  }
}
