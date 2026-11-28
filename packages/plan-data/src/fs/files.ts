import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const DATA_DIR = 'packages/plan-data/data'

/**
 * Looks for the data directory: `PLAN_DATA_DIR`, else the nearest `packages/plan-data/data` upwards from `cwd`, so
 * every package and the built server find it. Reads nothing but the directory tree; `cwd` and `env` are the caller's
 * (`process.cwd()` and `process.env`).
 */
export function findDataDir(cwd: string, env: Readonly<Record<string, string | undefined>>): string {
  if (env.PLAN_DATA_DIR) return env.PLAN_DATA_DIR
  for (let dir = cwd; ; dir = dirname(dir)) {
    const candidate = join(dir, DATA_DIR)
    if (existsSync(candidate) || dirname(dir) === dir) return candidate
  }
}

export const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'))

/** The file's JSON, or null when there is no such file. */
export const readJsonIfPresent = (file: string): unknown => (existsSync(file) ? readJson(file) : null)

/** An object read from a file; empty when the file is missing or holds something else. */
export function readObject(file: string): Record<string, unknown> {
  const stored = readJsonIfPresent(file)
  return typeof stored === 'object' && stored !== null && !Array.isArray(stored) ? { ...stored } : {}
}

/**
 * Writes `value` whole or not at all: to a temporary file in the same directory, then renamed over `file`, so a
 * reader never sees half of it. The file has `mode` when given (less what the umask takes), whatever mode the file it
 * replaces had: the temporary file is always new.
 */
export function writeJsonAtomic(file: string, value: unknown, mode?: number): void {
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, mode === undefined ? {} : { mode })
  renameSync(temporary, file)
}
