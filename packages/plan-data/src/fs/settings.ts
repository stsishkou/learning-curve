import { chmodSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

import type { UserId } from '@lc/plan-domain'
import { LOCAL_OWNER, type PrivateSettings } from '@lc/plan-service'

import { readObject, writeJsonAtomic } from './files'

const localFile = (dir: string, owner: UserId): string =>
  owner === LOCAL_OWNER ? join(dir, 'local.json') : join(dir, 'people', owner, 'local.json')

/**
 * Each person's private settings in `local.json`: `LOCAL_OWNER`'s in the data directory, anyone else's in
 * `people/<owner>/`. Never committed, since it holds a secret address. `busyFeedFromHost` (`BUSY_ICS_URL`) is the
 * local owner's address and wins over a saved one; nobody else is given it.
 *
 * Beyond the port: the file is readable by its owner only (mode 0600) from the moment it exists, and is replaced
 * by a rename. Other settings in the file are kept.
 */
export function createFsSettings(dir: string, busyFeedFromHost: string | null): PrivateSettings {
  const fixedFor = (owner: UserId): string | null => (owner === LOCAL_OWNER ? busyFeedFromHost : null)
  return {
    busyFeed: (owner) => {
      const fixed = fixedFor(owner)
      if (fixed) return Promise.resolve({ url: fixed, fixed: true })
      const { busyFeed } = readObject(localFile(dir, owner))
      return Promise.resolve({ url: typeof busyFeed === 'string' ? busyFeed : null, fixed: false })
    },
    setBusyFeed: (owner, url) => {
      const file = localFile(dir, owner)
      mkdirSync(dirname(file), { recursive: true })
      writeJsonAtomic(file, { ...readObject(file), busyFeed: url ?? undefined }, 0o600)
      // A file that was there keeps its old mode through a rename of a new one only when the mode option applies.
      chmodSync(file, 0o600)
      return Promise.resolve()
    },
  }
}
