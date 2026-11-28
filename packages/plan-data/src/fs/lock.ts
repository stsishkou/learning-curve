import { randomUUID } from 'node:crypto'
import { closeSync, fstatSync, mkdirSync, openSync, readFileSync, rmSync, utimesSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'
import { setTimeout as later } from 'node:timers/promises'

/** How often a waiter looks at the lock again. */
const POLL_MS = 150
/** How often a holder marks its lock as alive. */
const RENEW_MS = 15_000
/** A lock not marked alive for this long is stale, whoever holds it. */
const STALE_MS = 60_000

/** The lock file as one look found it: its text, which names the holder, and when it was last marked alive. */
interface Seen {
  readonly text: string
  readonly mtimeMs: number
}

const codeOf = (err: unknown): unknown => (err instanceof Error && 'code' in err ? err.code : undefined)

/** Opens `file` with `flags`; null when the open fails with `expected`, the one failure the caller looks for. */
function openUnless(file: string, flags: string, expected: string): number | null {
  try {
    return openSync(file, flags)
  } catch (err) {
    if (codeOf(err) === expected) return null
    throw err
  }
}

/** The lock file as it is now, or null when there is none. Text and time come from one open file, so they agree. */
function look(file: string): Seen | null {
  const fd = openUnless(file, 'r', 'ENOENT')
  if (fd === null) return null
  try {
    return { mtimeMs: fstatSync(fd).mtimeMs, text: readFileSync(fd, 'utf8') }
  } finally {
    closeSync(fd)
  }
}

/** Creates the lock file holding `mine`; false when it is there already. */
function create(file: string, mine: string): boolean {
  const fd = openUnless(file, 'wx', 'EEXIST')
  if (fd === null) return false
  try {
    writeSync(fd, mine)
  } catch (err) {
    closeSync(fd)
    // An empty lock names no holder, so every waiter would wait out STALE_MS for it.
    rmSync(file, { force: true })
    throw err
  }
  closeSync(fd)
  return true
}

/** The holder's pid as the lock names it; null while the holder is still writing it, or when it names none. */
function holderOf(text: string): number | null {
  try {
    const held: unknown = JSON.parse(text)
    if (typeof held !== 'object' || held === null || !('pid' in held)) return null
    const { pid } = held
    return typeof pid === 'number' && Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

/** True unless no process has `pid` here: one of another user answers `EPERM`, and is alive. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return codeOf(err) !== 'ESRCH'
  }
}

function stale(seen: Seen): boolean {
  if (Date.now() - seen.mtimeMs > STALE_MS) return true
  const pid = holderOf(seen.text)
  return pid !== null && !alive(pid)
}

/** Removes a stale lock, read once more just before: one another waiter took over meanwhile differs, and stays. */
function takeOver(file: string, seen: Seen): void {
  const now = look(file)
  if (now?.text === seen.text && now.mtimeMs === seen.mtimeMs) rmSync(file, { force: true })
}

/** Marks the lock alive, while it is still `mine`: one taken over meanwhile is its new holder's to keep. */
function renew(file: string, mine: string): void {
  if (look(file)?.text !== mine) return
  const now = new Date()
  utimesSync(file, now, now)
}

function release(file: string, mine: string): void {
  if (look(file)?.text === mine) rmSync(file, { force: true })
}

/**
 * Runs `work` while this holder alone holds the lock file `file`, in any process, and removes the file when `work`
 * settles, resolved or rejected. The file is created exclusively (`O_EXCL`) and names its holder's pid and the time it
 * was taken; while held, its modification time is renewed every 15 s. A waiter looks again every 150 ms, with no
 * time limit. A lock whose pid runs nowhere here, or that was not renewed for 60 s, is stale: it is read again just
 * before it is removed, removed only if unchanged, and the create is tried again.
 */
export async function holdLock<T>(file: string, work: () => Promise<T>): Promise<T> {
  // `id` tells this hold from the next one of the same process in the same millisecond: release removes only its own.
  const mine = JSON.stringify({ pid: process.pid, time: Date.now(), id: randomUUID() })
  mkdirSync(dirname(file), { recursive: true })
  while (!create(file, mine)) {
    const seen = look(file)
    if (seen && stale(seen)) {
      takeOver(file, seen)
    } else if (seen) {
      // oxlint-disable-next-line no-await-in-loop -- a waiter looks again only after the look before
      await later(POLL_MS)
    }
  }
  const renewal = setInterval(() => {
    try {
      renew(file, mine)
    } catch {
      // A throw here would end the process. Not renewed, the lock is stale only after STALE_MS; the next try may work.
    }
  }, RENEW_MS)
  renewal.unref()
  try {
    return await work()
  } finally {
    clearInterval(renewal)
    release(file, mine)
  }
}
