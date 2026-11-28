import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as later } from 'node:timers/promises'

import { emptyEdits, parsePlanId, parseUserId } from '@lc/plan-domain'
import { parseCalendarSync } from '@lc/plan-domain/sync'
import { CalendarAuthError, DEFAULT_PLAN, LOCAL_OWNER } from '@lc/plan-service'
import {
  describePlanLibrary,
  describePlanRepository,
  describePrivateSettings,
  describeSyncStateStore,
} from '@lc/plan-service/testing'
import { expect, test, vi } from 'vitest'

import { googleConnector } from '../google'
import { outlookConnector } from '../outlook'
import { bundledPlan, createFsPorts, findDataDir, type FsOptions } from './index'

const freshDir = (): string => mkdtempSync(join(tmpdir(), 'lc-fs-'))

/** A writable directory: the data directory of a checkout always holds a plan.json. */
const seededDir = (): string => {
  const dir = freshDir()
  writeFileSync(join(dir, 'plan.json'), `${JSON.stringify(bundledPlan, null, 2)}\n`)
  return dir
}

const portsIn = (dir: string, options: Partial<Omit<FsOptions, 'dir'>> = {}) =>
  createFsPorts({
    dir,
    busyFeedFromHost: null,
    calendarIds: {},
    connectors: { google: googleConnector, outlook: outlookConnector },
    clientsFromHost: {},
    ...options,
  })

const seededPorts = (options: Partial<Omit<FsOptions, 'dir'>> = {}) => portsIn(seededDir(), options)

describePlanRepository('fs plans', () =>
  Promise.resolve({ repo: seededPorts().plans, seeded: DEFAULT_PLAN, owner: LOCAL_OWNER }),
)
describePlanLibrary('fs library', () => Promise.resolve({ library: seededPorts().library, owner: LOCAL_OWNER }))
describePlanLibrary('fs library of another owner', () =>
  Promise.resolve({ library: seededPorts().library, owner: parseUserId('someone') }),
)
describeSyncStateStore('fs sync state', () => Promise.resolve({ store: seededPorts().syncState, plan: DEFAULT_PLAN }))
describePrivateSettings('fs settings', () => Promise.resolve({ settings: seededPorts().settings, owner: LOCAL_OWNER }))

test('a directory with no plan.json reads as the bundled plan and cannot be written', async () => {
  const ports = portsIn(freshDir())
  const stored = await ports.plans.get(DEFAULT_PLAN)
  expect(stored?.plan).toEqual(bundledPlan)
  expect(stored?.edits).toEqual(emptyEdits())
  expect(stored?.history.steps).toEqual([])
  expect(await ports.plans.revision(DEFAULT_PLAN)).toBeNull()
  expect(ports.canWrite()).toBe(false)
})

test('a directory that does not exist reads as the bundled plan', async () => {
  const ports = portsIn(join(freshDir(), 'missing'))
  const stored = await ports.plans.get(DEFAULT_PLAN)
  expect(stored?.plan).toEqual(bundledPlan)
  expect(await ports.library.list(LOCAL_OWNER)).toEqual([])
})

test('a directory with a plan.json can be written and has a revision', async () => {
  const ports = seededPorts()
  expect(ports.canWrite()).toBe(true)
  expect(await ports.plans.revision(DEFAULT_PLAN)).toEqual(expect.any(String))
})

test('a save that changes nothing leaves plan.json byte for byte as it was', async () => {
  const dir = seededDir()
  const { plans } = portsIn(dir)
  const stored = await plans.get(DEFAULT_PLAN)
  if (!stored) throw new Error('The plan is missing')
  const write = { edits: stored.edits, history: stored.history, plan: stored.plan }
  const first = await plans.save(DEFAULT_PLAN, write, stored.revision)
  if (!first.ok) throw new Error('The save conflicted')
  const afterFirst = readFileSync(join(dir, 'plan.json'), 'utf8')
  const second = await plans.save(DEFAULT_PLAN, write, first.value)
  expect(second.ok).toBe(true)
  expect(readFileSync(join(dir, 'plan.json'), 'utf8')).toBe(afterFirst)
})

test('a conflicting save writes nothing', async () => {
  const dir = seededDir()
  const { plans } = portsIn(dir)
  const stored = await plans.get(DEFAULT_PLAN)
  if (!stored) throw new Error('The plan is missing')
  const edits = { ...stored.edits, budget: 9 }
  const result = await plans.save(DEFAULT_PLAN, { ...stored, edits }, 'not the revision')
  expect(result).toEqual({ ok: false, error: 'conflict' })
  expect(statSync(join(dir, 'edits.json'), { throwIfNoEntry: false })).toBeUndefined()
})

test('a change made to the files elsewhere moves the revision', async () => {
  const dir = seededDir()
  const { plans } = portsIn(dir)
  const before = await plans.revision(DEFAULT_PLAN)
  writeFileSync(join(dir, 'edits.json'), JSON.stringify({ ...emptyEdits(), budget: 8 }))
  expect(await plans.revision(DEFAULT_PLAN)).not.toBe(before)
  const after = await plans.get(DEFAULT_PLAN)
  expect(after?.edits.budget).toBe(8)
})

test('plan.json is parsed once per version: an unchanged file is not read again, a changed one is', async () => {
  const dir = seededDir()
  const { plans } = portsIn(dir)
  const file = join(dir, 'plan.json')
  const listed = [{ id: DEFAULT_PLAN, title: bundledPlan.meta.title }]
  expect(await plans.listOwned(LOCAL_OWNER)).toEqual(listed)
  chmodSync(file, 0o000)
  try {
    // Unreadable now: only the plan kept from the read before can answer.
    expect(await plans.listOwned(LOCAL_OWNER)).toEqual(listed)
    const stored = await plans.get(DEFAULT_PLAN)
    expect(stored?.plan).toEqual(bundledPlan)
  } finally {
    chmodSync(file, 0o644)
  }
  writeFileSync(file, JSON.stringify({ ...bundledPlan, meta: { ...bundledPlan.meta, title: 'Changed elsewhere' } }))
  expect(await plans.listOwned(LOCAL_OWNER)).toEqual([{ id: DEFAULT_PLAN, title: 'Changed elsewhere' }])
})

test('an unknown plan id has no revision and is not listed', async () => {
  const ports = seededPorts()
  expect(await ports.plans.revision(parsePlanId('other'))).toBeNull()
})

test('local.json is readable by its owner only, also when it was not before', async () => {
  const dir = seededDir()
  const { settings } = portsIn(dir)
  await settings.setBusyFeed(LOCAL_OWNER, 'https://x/a.ics')
  expect(statSync(join(dir, 'local.json')).mode & 0o777).toBe(0o600)
  chmodSync(join(dir, 'local.json'), 0o644)
  await settings.setBusyFeed(LOCAL_OWNER, 'https://x/b.ics')
  expect(statSync(join(dir, 'local.json')).mode & 0o777).toBe(0o600)
})

test('an address set by the host wins and is fixed', async () => {
  const { settings } = seededPorts({ busyFeedFromHost: 'https://x/a.ics' })
  await settings.setBusyFeed(LOCAL_OWNER, 'https://y/b.ics')
  expect(await settings.busyFeed(LOCAL_OWNER)).toEqual({ url: 'https://x/a.ics', fixed: true })
  expect(await settings.busyFeed(parseUserId('stranger'))).toEqual({ url: null, fixed: false })
})

test('setting the address keeps the other settings in local.json', async () => {
  const dir = seededDir()
  writeFileSync(join(dir, 'local.json'), JSON.stringify({ other: 1 }))
  await portsIn(dir).settings.setBusyFeed(LOCAL_OWNER, 'https://x/a.ics')
  expect(JSON.parse(readFileSync(join(dir, 'local.json'), 'utf8'))).toEqual({ other: 1, busyFeed: 'https://x/a.ics' })
})

test('two directories do not see each other', async () => {
  const one = seededPorts()
  const two = seededPorts()
  await one.settings.setBusyFeed(LOCAL_OWNER, 'https://x/a.ics')
  expect(await two.settings.busyFeed(LOCAL_OWNER)).toEqual({ url: null, fixed: false })
})

test('sync state keeps the file layout the app already writes, and reads ids from the uid for old rows', async () => {
  const dir = seededDir()
  writeFileSync(
    join(dir, 'sync.json'),
    JSON.stringify({
      feed: { revisions: { e1: { seq: 1, modified: 5, hash: 'h' } } },
      google: { calendars: { study: { id: 'cal', summary: 'S' } }, events: { u1: { calendar: 'study', hash: 'x' } } },
    }),
  )
  const { syncState } = portsIn(dir, { calendarIds: { google: (uid) => `g-${uid}` } })
  expect(await syncState.feedRevisions(DEFAULT_PLAN)).toEqual({ e1: { seq: 1, modified: 5, hash: 'h' } })
  const google = await syncState.calendarSync(DEFAULT_PLAN, 'google')
  expect(google.events.u1?.id).toBe('g-u1')
  await syncState.saveFeedRevisions(DEFAULT_PLAN, {})
  const written: unknown = JSON.parse(readFileSync(join(dir, 'sync.json'), 'utf8'))
  expect(written).toMatchObject({ google: { calendars: { study: { id: 'cal', summary: 'S' } } } })
})

test('another plan keeps its sync state in its own folder, created by the first save', async () => {
  const dir = seededDir()
  const { syncState } = portsIn(dir)
  const other = parsePlanId('other')
  const revisions = { e1: { seq: 1, modified: 5, hash: 'h' } }
  const sync = { ...parseCalendarSync(null), calendars: { study: { id: 'cal', summary: 'S' } } }
  await syncState.saveFeedRevisions(other, revisions)
  await syncState.saveCalendarSync(other, 'google', sync)
  expect(await syncState.feedRevisions(other)).toEqual(revisions)
  expect(await syncState.calendarSync(other, 'google')).toEqual(sync)
  expect(statSync(join(dir, 'plans', 'other', 'sync.json')).isFile()).toBe(true)
  expect(await syncState.feedRevisions(DEFAULT_PLAN)).toEqual({})
})

test('the library keeps one owner in library/ and another in people/<id>/library/', async () => {
  const dir = seededDir()
  const { library } = portsIn(dir)
  const file = { version: 1 as const, id: 'plan-one', name: 'One', versions: [] }
  await library.put(LOCAL_OWNER, file)
  await library.put(parseUserId('someone'), file)
  expect(statSync(join(dir, 'library', 'plan-one.json')).isFile()).toBe(true)
  expect(statSync(join(dir, 'people', 'someone', 'library', 'plan-one.json')).isFile()).toBe(true)
})

test('findDataDir takes PLAN_DATA_DIR, else the nearest data directory upwards', () => {
  expect(findDataDir('/anywhere', { PLAN_DATA_DIR: '/elsewhere' })).toBe('/elsewhere')
  const root = freshDir()
  mkdirSync(join(root, 'packages', 'plan-data', 'data'), { recursive: true })
  mkdirSync(join(root, 'apps', 'web'), { recursive: true })
  expect(findDataDir(join(root, 'apps', 'web'), {})).toBe(join(root, 'packages', 'plan-data', 'data'))
})

test('a client saved for a calendar app is kept trimmed beside the other settings, readable by its owner only', async () => {
  const dir = seededDir()
  writeFileSync(join(dir, 'local.json'), JSON.stringify({ busyFeed: 'https://x/a.ics' }))
  const { calendarSignIn } = portsIn(dir)
  expect(await calendarSignIn.status('google')).toEqual({ configured: false, connectedAt: null })
  await calendarSignIn.saveClient('google', ' id ', ' secret ')
  expect(await calendarSignIn.status('google')).toEqual({ configured: true, connectedAt: null })
  expect(await calendarSignIn.status('outlook')).toEqual({ configured: false, connectedAt: null })
  expect(JSON.parse(readFileSync(join(dir, 'local.json'), 'utf8'))).toEqual({
    busyFeed: 'https://x/a.ics',
    google: { clientId: 'id', clientSecret: 'secret' },
  })
  expect(statSync(join(dir, 'local.json')).mode & 0o777).toBe(0o600)
})

test('a client the host sets wins over a saved one; a part it leaves empty is the saved one', async () => {
  const dir = seededDir()
  await portsIn(dir).calendarSignIn.saveClient('google', 'saved-id', 'saved-secret')
  const hosted = portsIn(dir, { clientsFromHost: { google: { id: 'host-id', secret: '' } } })
  const address = new URL(await hosted.calendarSignIn.connectAddress('google', 'http://localhost/cb'))
  expect(address.searchParams.get('client_id')).toBe('host-id')
  const fresh = portsIn(seededDir(), { clientsFromHost: { outlook: { id: 'host-id', secret: 'host-secret' } } })
  expect(await fresh.calendarSignIn.status('outlook')).toEqual({ configured: true, connectedAt: null })
})

test('a sign-in needs a client and its own state, and a token needs a connected account', async () => {
  const { calendarSignIn, calendarTokens } = seededPorts()
  const noClient = calendarSignIn.connectAddress('google', 'http://localhost/cb')
  await expect(noClient).rejects.toBeInstanceOf(CalendarAuthError)
  await expect(noClient).rejects.toMatchObject({ reason: 'client' })
  await expect(calendarSignIn.finishConnect('google', 'code', 'unknown')).rejects.toMatchObject({ reason: 'state' })
  const token = calendarTokens.token(LOCAL_OWNER, 'google', false)
  await expect(token).rejects.toBeInstanceOf(CalendarAuthError)
  await expect(token).rejects.toMatchObject({ reason: 'reconnect' })
})

/** A lock in `dir` as another holder would leave it: its pid and its time, which is also its modification time. */
function lockOf(dir: string, pid: number, time = Date.now()): string {
  const lock = join(dir, 'sync.lock')
  writeFileSync(lock, JSON.stringify({ pid, time }))
  utimesSync(lock, new Date(time), new Date(time))
  return lock
}

const ran = () => Promise.resolve('ran')

const nothing = (): void => undefined

test('a lock whose holder no longer runs is taken over', async () => {
  const dir = seededDir()
  const { pid } = spawnSync(process.execPath, ['--eval', ''])
  lockOf(dir, pid)
  await expect(portsIn(dir).syncState.exclusive(DEFAULT_PLAN, ran)).resolves.toBe('ran')
  expect(existsSync(join(dir, 'sync.lock'))).toBe(false)
})

test('a lock not renewed for a minute is taken over, though its holder runs', async () => {
  const dir = seededDir()
  lockOf(dir, process.pid, Date.now() - 61_000)
  await expect(portsIn(dir).syncState.exclusive(DEFAULT_PLAN, ran)).resolves.toBe('ran')
})

test('a fresh lock of a running holder is waited for', async () => {
  const dir = seededDir()
  const lock = lockOf(dir, process.pid)
  let started = false
  const waiting = portsIn(dir).syncState.exclusive(DEFAULT_PLAN, () => {
    started = true
    return ran()
  })
  await later(600)
  expect(started).toBe(false)
  rmSync(lock)
  await expect(waiting).resolves.toBe('ran')
  expect(started).toBe(true)
})

test('a held lock is renewed while its work runs, and its timer stops with the work', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  try {
    const dir = seededDir()
    const lock = join(dir, 'sync.lock')
    let finish = nothing
    const working = portsIn(dir).syncState.exclusive(
      DEFAULT_PLAN,
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const old = Date.now() - 30_000
    utimesSync(lock, new Date(old), new Date(old))
    const held: unknown = JSON.parse(readFileSync(lock, 'utf8'))
    expect(held).toMatchObject({ pid: process.pid })
    expect(held).toHaveProperty('time', expect.any(Number))
    vi.advanceTimersByTime(15_000)
    expect(statSync(lock).mtimeMs).toBeGreaterThan(old + 20_000)
    expect(vi.getTimerCount()).toBe(1)
    finish()
    await working
    expect(vi.getTimerCount()).toBe(0)
    expect(existsSync(lock)).toBe(false)
  } finally {
    vi.useRealTimers()
  }
})

test('another plan locks in its own folder', async () => {
  const dir = seededDir()
  let seen = false
  await portsIn(dir).syncState.exclusive(parsePlanId('other'), () => {
    seen = existsSync(join(dir, 'plans', 'other', 'sync.lock'))
    return ran()
  })
  expect(seen).toBe(true)
  expect(existsSync(join(dir, 'plans', 'other', 'sync.lock'))).toBe(false)
})
