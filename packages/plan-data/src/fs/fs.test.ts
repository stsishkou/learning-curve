import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { emptyEdits, parsePlanId, parseUserId } from '@lc/plan-domain'
import { DEFAULT_PLAN, LOCAL_OWNER } from '@lc/plan-service'
import {
  describePlanLibrary,
  describePlanRepository,
  describePrivateSettings,
  describeSyncStateStore,
} from '@lc/plan-service/testing'
import { expect, test } from 'vitest'

import { bundledPlan, createFsPorts, findDataDir, type FsOptions } from './index'

const freshDir = (): string => mkdtempSync(join(tmpdir(), 'lc-fs-'))

/** A writable directory: the data directory of a checkout always holds a plan.json. */
const seededDir = (): string => {
  const dir = freshDir()
  writeFileSync(join(dir, 'plan.json'), `${JSON.stringify(bundledPlan, null, 2)}\n`)
  return dir
}

const portsIn = (dir: string, options: Partial<Omit<FsOptions, 'dir'>> = {}) =>
  createFsPorts({ dir, busyFeedFromHost: null, calendarIds: {}, ...options })

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

test('an unknown plan id has no revision and is not listed', async () => {
  const ports = seededPorts()
  expect(await ports.plans.revision(parsePlanId('other'))).toBeNull()
})

test('local.json is readable by its owner only', async () => {
  const dir = seededDir()
  const { settings } = portsIn(dir)
  await settings.setBusyFeed(LOCAL_OWNER, 'https://x/a.ics')
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
