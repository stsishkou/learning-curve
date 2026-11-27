import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { addDays, isSession, type PlanChange, type PlanEvent } from '@lc/plan-domain'
import { itemAt } from '@lc/plan-domain/fixtures'
import { DEFAULT_PLAN, LOCAL_ACTOR, createPlanServices, type Result } from '@lc/plan-service'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'

import { bundledPlan } from '../fs'
import { localPorts } from '../local'
import { FakeOutlook } from './fake-outlook'

const dir = mkdtempSync(join(tmpdir(), 'lc-outlook-'))
const outlook = new FakeOutlook()
const ports = localPorts({ dir, env: {} })
const { plans, calendars } = createPlanServices(ports)
const actor = LOCAL_ACTOR
const CALLBACK = 'http://localhost:3000/api/outlook/callback'

function value<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error(`The call failed: ${JSON.stringify(result.error)}`)
  return result.value
}

beforeAll(async () => {
  vi.stubGlobal('fetch', outlook.fetch)
  // A checkout always holds a plan.json; the plan is then generated with no edits, as `pnpm run plan` does.
  writeFileSync(join(dir, 'plan.json'), `${JSON.stringify(bundledPlan, null, 2)}\n`)
  value(await plans.rebuild(actor))
})

afterAll(() => {
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
})

const readPlan = async () => value(await plans.read(actor))
const status = async () => value(await calendars.status(actor, 'outlook'))
const sync = async () => value(await calendars.sync(actor, 'outlook'))
const save = async (changes: PlanChange[]) => value(await plans.apply(actor, changes))
const history = async () => value(await plans.view(actor)).history

async function planEvent(uid: string) {
  const plan = await readPlan()
  return plan.events.find((e) => e.uid === uid)
}

async function sessions() {
  const plan = await readPlan()
  return plan.events.filter((e) => isSession(e) && !e.done && !e.rrule)
}

const day = (event: PlanEvent) => event.start.slice(0, 10)

/** The Outlook id the sync keeps for a plan event. */
async function idOf(event: PlanEvent): Promise<string> {
  const kept = await ports.syncState.calendarSync(DEFAULT_PLAN, 'outlook')
  return kept.events[event.uid]?.id ?? ''
}

const at = (wall: string) => ({ dateTime: `${wall}:00.0000000`, timeZone: 'Belarus Standard Time' })

async function undo(steps: number) {
  const { cursor } = await history()
  value(await plans.travel(actor, cursor - steps))
}

test('connecting asks Microsoft for the calendars and a refresh token, and keeps the one it hands out', async () => {
  expect(await status()).toMatchObject({ configured: false, connectedAt: null })
  value(await calendars.saveClient(actor, 'outlook', ' 00000000-aaaa-bbbb-cccc-000000000000 ', 'secret'))
  const address = new URL(value(await calendars.connectAddress(actor, 'outlook', CALLBACK)))
  expect(address.origin + address.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
  expect(address.searchParams.get('scope')).toBe('offline_access https://graph.microsoft.com/Calendars.ReadWrite')
  expect(address.searchParams.get('prompt')).toBe('select_account')
  value(await calendars.finishConnect(actor, 'outlook', 'code', address.searchParams.get('state') ?? ''))
  const verifier = outlook.exchanged.code_verifier ?? ''
  expect(createHash('sha256').update(verifier).digest('base64url')).toBe(address.searchParams.get('code_challenge'))
  expect(outlook.exchanged).toMatchObject({ redirect_uri: CALLBACK, client_secret: 'secret' })
  const connected = await status()
  expect(connected.connectedAt).toBeTypeOf('number')
})

test('the first round writes every calendar and event, the days a repeat skips cancelled; the next writes nothing', async () => {
  const plan = await readPlan()
  const repeat = itemAt(plan.events.filter((e) => e.rrule))
  await save([{ type: 'event.patch', uid: repeat.uid, patch: { skip: [addDays(day(repeat), 2)] } }])
  const first = await sync()
  expect(first.error).toBeNull()
  expect([...outlook.calendars.values()]).toEqual(plan.calendars.map((c) => c.name))
  expect(outlook.live()).toHaveLength(plan.events.length)
  expect(outlook.exceptions.get(await idOf(repeat))?.get(addDays(day(repeat), 2))).toBe('cancelled')
  // Microsoft handed out a new refresh token with the access token; the old one is spent.
  expect(JSON.parse(readFileSync(join(dir, 'local.json'), 'utf8'))).toMatchObject({
    outlook: { refreshToken: outlook.refresh },
  })

  const writes = outlook.writes
  expect(await sync()).toMatchObject({ inbox: [], error: null, events: plan.events.length })
  expect(outlook.writes).toBe(writes)
})

test('a ✓ typed and a move made in Outlook go into the plan by themselves', async () => {
  const [ticked, moved] = [itemAt(await sessions()), itemAt(await sessions(), 1)]
  outlook.edit(await idOf(ticked), { subject: `✓ ${ticked.title}` })
  outlook.edit(await idOf(moved), { start: at(`${day(moved)}T06:00`), end: at(`${day(moved)}T07:00`) })
  const round = await sync()
  expect(round).toMatchObject({ inbox: [], error: null })
  expect(await planEvent(ticked.uid)).toMatchObject({ done: true })
  expect(await planEvent(moved.uid)).toMatchObject({ start: `${day(moved)}T06:00`, end: `${day(moved)}T07:00` })
  const { steps } = await history()
  expect(steps.at(-1)?.source).toBe('outlook')
  expect(outlook.event(await idOf(ticked))).toMatchObject({ showAs: 'free' })
})

test('a session deleted in Outlook goes to the trash; Undo writes it again', async () => {
  const trashed = itemAt(await sessions(), 2)
  const id = await idOf(trashed)
  outlook.remove(id)
  expect(await sync()).toMatchObject({ inbox: [] })
  expect(await planEvent(trashed.uid)).toBeUndefined()

  await undo(1)
  await sync()
  expect(await idOf(trashed)).not.toBe(id)
  expect(outlook.event(await idOf(trashed))).toMatchObject({ subject: trashed.title })
})

test('a repeat cancelled in Outlook skips that day; one moved there becomes an event of its own', async () => {
  const plan = await readPlan()
  const repeat = itemAt(plan.events.filter((e) => e.rrule))
  const series = await idOf(repeat)
  const first = day(repeat)
  outlook.repeat(series, first, 'cancelled')
  expect(await sync()).toMatchObject({ inbox: [], error: null })
  const skipped = await planEvent(repeat.uid)
  expect(skipped?.skip).toContain(first)

  const next = addDays(first, 7)
  outlook.repeat(await idOf(repeat), next, { start: at(`${next}T19:00`), end: at(`${next}T20:00`) })
  expect(await sync()).toMatchObject({ inbox: [], error: null })
  const detached = await planEvent(repeat.uid)
  expect(detached?.skip).toContain(next)
  const after = await readPlan()
  const single = after.events.find((e) => e.start === `${next}T19:00`)
  expect(single && outlook.event(await idOf(single))).toMatchObject({ subject: repeat.title })
  expect(outlook.exceptions.get(await idOf(repeat))?.get(next)).toBe('cancelled')
})

test('an event moved to another calendar in the planner is written there and deleted from the old one', async () => {
  const session = itemAt(await sessions(), 3)
  const plan = await readPlan()
  const elsewhere = itemAt(plan.calendars.filter((c) => c.id !== session.calendar))
  const before = await idOf(session)
  await save([{ type: 'event.patch', uid: session.uid, patch: { calendar: elsewhere.id } }])
  expect(await sync()).toMatchObject({ error: null })
  expect(outlook.event(before)).toBeUndefined()
  const target = [...outlook.calendars].find(([, name]) => name === elsewhere.name)?.[0]
  expect(outlook.stored.get(await idOf(session))?.calendar).toBe(target)
})

test('an edit to what the planner changed too waits; keeping the plan writes it over Outlook', async () => {
  const kept = itemAt(await sessions(), 4)
  // Changed in Outlook, then in the planner before any round read Outlook: a save starts a round at once.
  outlook.edit(await idOf(kept), { start: at(`${day(kept)}T06:00`), end: at(`${day(kept)}T07:00`) })
  await save([
    { type: 'event.patch', uid: kept.uid, patch: { start: `${day(kept)}T20:00`, end: `${day(kept)}T21:00` } },
  ])
  const round = await sync()
  expect(round.inbox).toMatchObject([{ uid: kept.uid, hold: 'both' }])
  value(
    await calendars.reject(
      actor,
      'outlook',
      round.inbox.map((item) => item.id),
    ),
  )
  expect(outlook.event(await idOf(kept))?.start).toMatchObject({ dateTime: `${day(kept)}T20:00:00` })
  expect(await status()).toMatchObject({ inbox: [] })
})

test('an account without a mailbox, and a sign-in Microsoft no longer takes, are named as such', async () => {
  const count = outlook.calendars.size
  outlook.noMailbox = true
  await save([{ type: 'event.patch', uid: itemAt(await sessions(), 5).uid, patch: { title: 'Без почты' } }])
  expect(await sync()).toMatchObject({ error: 'mailbox' })
  outlook.noMailbox = false
  expect(await sync()).toMatchObject({ error: null })
  // The calendars it could not reach were not taken for deleted, and are not made twice.
  expect(outlook.calendars.size).toBe(count)

  outlook.revoked = true
  await save([{ type: 'event.patch', uid: itemAt(await sessions(), 5).uid, patch: { title: 'Без доступа' } }])
  expect(await sync()).toMatchObject({ error: 'reconnect', connectedAt: null })
  outlook.revoked = false
})
