import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { parseStoredFile, type StoredPlanFile, type UserId } from '@lc/plan-domain'
import { LOCAL_OWNER, type PlanLibrary } from '@lc/plan-service'

import { readJson, writeJsonAtomic } from './files'

// An id becomes a file name: nothing but these characters may reach the disk.
const FILE_ID = /^[a-z0-9][a-z0-9-]{0,60}$/

const libraryDir = (dir: string, owner: UserId): string =>
  owner === LOCAL_OWNER ? join(dir, 'library') : join(dir, 'people', owner, 'library')

function readFile(file: string): StoredPlanFile | null {
  return existsSync(file) ? parseStoredFile(readJson(file)) : null
}

/**
 * Each owner's plan files, one `<id>.json` holding the file with its versions: `library/` for `LOCAL_OWNER`,
 * `people/<owner>/library/` for anyone else. Local to a checkout and not committed.
 *
 * Beyond the port: a file is replaced by a rename, so a reader never sees half of it; a file that cannot be read
 * is left out of `list`; and an id that is not a valid file id never reaches the disk, so no id can name a path
 * outside the owner's folder.
 */
export function createFsLibrary(dir: string): PlanLibrary {
  return {
    list: (owner) => {
      const folder = libraryDir(dir, owner)
      if (!existsSync(folder)) return Promise.resolve([])
      const files = readdirSync(folder)
        .filter((name) => name.endsWith('.json'))
        .flatMap((name) => {
          try {
            const stored = readFile(join(folder, name))
            return stored ? [stored] : []
          } catch {
            return []
          }
        })
      return Promise.resolve(files)
    },
    get: (owner, id) => Promise.resolve(FILE_ID.test(id) ? readFile(join(libraryDir(dir, owner), `${id}.json`)) : null),
    put: (owner, file) => {
      if (!FILE_ID.test(file.id)) return Promise.reject(new Error('Unknown plan file'))
      const folder = libraryDir(dir, owner)
      mkdirSync(folder, { recursive: true })
      writeJsonAtomic(join(folder, `${file.id}.json`), file)
      return Promise.resolve()
    },
    remove: (owner, id) => {
      if (FILE_ID.test(id)) rmSync(join(libraryDir(dir, owner), `${id}.json`), { force: true })
      return Promise.resolve()
    },
  }
}
