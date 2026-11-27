import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { addDays, isSession, type PlanChange, type PlanEvent } from '@lc/plan-domain'
import { itemAt } from '@lc/plan-domain/fixtures'
import { GOOGLE_SCOPE, googleEventId } from '@lc/plan-domain/sync'
import { DEFAULT_PLAN, LOCAL_ACTOR, createPlanServices, type Result } from '@lc/plan-service'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'

import { bundledPlan } from '../fs'
import { localPorts } from '../local'
import { FakeGoogle } from './fake-google'

const dir = mkdtempSync(join(tmpdir(), 'lc-google-'))
const google = new FakeGoogle()
const ports = localPorts({ dir, env: {} })
const { plans, calendars } = createPlanServices(ports)
const actor = LOCAL_ACTOR
const CALLBACK = 'http://localhost:3000/api/google/callback'

function value<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error(`The call failed: ${JSON.stringify(result.error)}`)
  return result.value
}

beforeAll(async () => {
  vi.stubGlobal('fetch', google.fetch)
  // A checkout always holds a plan.json; the plan is then generated with no edits, as `pnpm run plan` does.
  writeFileSync(join(dir, 'plan.json'), `${JSON.stringify(bundledPlan, null, 2)}\n`)
  value(await plans.rebuild(actor))
})

afterAll(() => {
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
})

const readPlan = async () => value(await plans.read(actor))
const status = async () => value(await calendars.status(actor, 'google'))
const sync = async () => value(await calendars.sync(actor, 'google'))
const save = async (changes: PlanChange[]) => value(await plans.apply(actor, changes))
const history = async () => value(await plans.view(actor)).history

async function planEvent(uid: string) {
  const plan = await readPlan()
  return plan.events.find((e) => e.uid === uid)
}

async function sessions() {
  const plan = await readPlan()
  return plan.events.filter((e) => isSession(e) && !e.done)
}

const idOf = (event: PlanEvent) => googleEventId(event.uid)
const day = (event: PlanEvent) => event.start.slice(0, 10)

test('connecting keeps a refresh token that only the owner can read', async () => {
  expect(await status()).toMatchObject({ configured: false, connectedAt: null })
  await expect(calendars.connectAddress(actor, 'google', CALLBACK)).rejects.toThrow()
  value(await calendars.saveClient(actor, 'google', ' client.apps.googleusercontent.com ', 'secret '))
  const address = new URL(value(await calendars.connectAddress(actor, 'google', CALLBACK)))
  expect(address.searchParams.get('scope')).toBe(GOOGLE_SCOPE)
  expect(address.searchParams.get('client_id')).toBe('client.apps.googleusercontent.com')
  const state = address.searchParams.get('state') ?? ''
  expect(await calendars.finishConnect(actor, 'google', 'code', 'another')).toEqual({ ok: false, error: 'failed' })

  value(await calendars.finishConnect(actor, 'google', 'code', state))
  const verifier = google.exchanged.code_verifier ?? ''
  expect(createHash('sha256').update(verifier).digest('base64url')).toBe(address.searchParams.get('code_challenge'))
  expect(google.exchanged).toMatchObject({ redirect_uri: CALLBACK, code: 'code' })
  const local = join(dir, 'local.json')
  expect(JSON.parse(readFileSync(local, 'utf8'))).toMatchObject({ google: { refreshToken: 'refresh' } })
  expect(statSync(local).mode & 0o777).toBe(0o600)
  const connected = await status()
  expect(connected.configured).toBe(true)
  expect(connected.connectedAt).toBeTypeOf('number')
  expect(await calendars.finishConnect(actor, 'google', 'code', state)).toEqual({ ok: false, error: 'failed' })
})

test('the first round makes a calendar for each plan calendar and writes every event; the next writes nothing', async () => {
  const plan = await readPlan()
  const first = await sync()
  expect(first.error).toBeNull()
  expect([...google.calendars.values()]).toEqual(plan.calendars.map((c) => c.name))
  expect(google.live()).toHaveLength(plan.events.length)
  const repeat = itemAt(plan.events.filter((e) => e.rrule))
  expect(google.event(idOf(repeat))).toMatchObject({ recurrence: [`RRULE:${repeat.rrule}`] })

  const writes = google.writes
  expect(await sync()).toMatchObject({ inbox: [], error: null, events: plan.events.length })
  expect(google.writes).toBe(writes)
})

/** Undo as the planner does it: the plan goes back `steps` steps, and the next round writes it to Google. */
async function undo(steps: number) {
  const { cursor } = await history()
  value(await plans.travel(actor, cursor - steps))
}

const slot = (event: PlanEvent, from: string, to: string) => ({
  start: { dateTime: `${day(event)}T${from}:00+03:00` },
  end: { dateTime: `${day(event)}T${to}:00+03:00` },
})

test('a ✓ typed in Google marks the session done by itself, as a step of the history', async () => {
  const session = itemAt(await sessions())
  google.edit(idOf(session), { summary: `✓ ${session.title}` })
  const round = await sync()
  expect(round).toMatchObject({ inbox: [], error: null })
  expect(round.takenAt).toBeTypeOf('number')
  expect(await planEvent(session.uid)).toMatchObject({ done: true })
  const { steps } = await history()
  expect(steps.at(-1)).toMatchObject({ source: 'google', subject: session.title })
  expect(google.event(idOf(session))).toMatchObject({ summary: `✓ ${session.title}`, transparency: 'transparent' })
  const writes = google.writes
  await sync()
  expect(google.writes).toBe(writes)
})

test('a move and a new title made in Google go into the plan, and Undo writes the plan back', async () => {
  const [moved, renamed] = [itemAt(await sessions(), 1), itemAt(await sessions(), 2)]
  google.edit(idOf(moved), slot(moved, '06:00', '07:00'))
  google.edit(idOf(renamed), { summary: 'Lunch' })
  expect(await sync()).toMatchObject({ inbox: [] })
  expect(await planEvent(moved.uid)).toMatchObject({ start: `${day(moved)}T06:00`, end: `${day(moved)}T07:00` })
  expect(await planEvent(renamed.uid)).toMatchObject({ title: 'Lunch' })

  await undo(2)
  await sync()
  expect(google.event(idOf(moved))?.start).toEqual({ dateTime: `${moved.start}:00`, timeZone: 'Europe/Minsk' })
  expect(google.event(idOf(renamed))?.summary).toBe(renamed.title)
})

test('an edit to what the planner changed too waits, and is left alone in Google until decided', async () => {
  const [kept, taken] = [itemAt(await sessions(), 3), itemAt(await sessions(), 4)]
  // Changed in Google, then in the planner before any round read Google: a save starts a round at once.
  google.edit(idOf(kept), slot(kept, '06:00', '07:00'))
  google.edit(idOf(taken), slot(taken, '06:00', '07:00'))
  await save(
    [kept, taken].map((e) => ({
      type: 'event.patch',
      uid: e.uid,
      patch: { start: `${day(e)}T20:00`, end: `${day(e)}T21:00` },
    })),
  )
  const round = await sync()
  expect(round.inbox).toMatchObject([{ hold: 'both' }, { hold: 'both' }])
  expect(google.event(idOf(kept))?.start).toEqual(slot(kept, '06:00', '07:00').start)

  const of = (event: PlanEvent) => round.inbox.filter((item) => item.uid === event.uid).map((item) => item.id)
  value(await calendars.reject(actor, 'google', of(kept)))
  expect(google.event(idOf(kept))?.start).toEqual({ dateTime: `${day(kept)}T20:00:00`, timeZone: 'Europe/Minsk' })
  expect(value(await calendars.accept(actor, 'google', of(taken)))).toMatchObject({ inbox: [] })
  expect(await planEvent(taken.uid)).toMatchObject({ start: `${day(taken)}T06:00` })
})

test('a session deleted in Google goes to the trash, and Undo brings it back there too', async () => {
  const trashed = itemAt(await sessions(), 5)
  google.edit(idOf(trashed), { status: 'cancelled' })
  expect(await sync()).toMatchObject({ inbox: [] })
  expect(await planEvent(trashed.uid)).toBeUndefined()
  const stored = await ports.plans.get(DEFAULT_PLAN)
  expect(stored?.edits.removed.events[trashed.uid]).toBeTypeOf('string')

  await undo(1)
  await sync()
  expect(google.event(idOf(trashed))?.status).toBe('confirmed')
})

test('a repeat deleted in Google skips that day; one moved there becomes an event of its own', async () => {
  const plan = await readPlan()
  const repeat = itemAt(plan.events.filter((e) => e.rrule))
  const series = idOf(repeat)
  google.repeat(series, repeat.start, { status: 'cancelled' })
  expect(await sync()).toMatchObject({ inbox: [] })
  expect(await planEvent(repeat.uid)).toMatchObject({ skip: [day(repeat)] })
  const exdate = `EXDATE;TZID=Europe/Minsk:${day(repeat).replaceAll('-', '')}T${repeat.start.slice(11).replace(':', '')}00`
  expect(google.event(series)?.recurrence).toEqual([`RRULE:${repeat.rrule}`, exdate])

  const next = addDays(day(repeat), 7)
  const instance = google.repeat(series, `${next}${repeat.start.slice(10)}`, {
    start: { dateTime: `${next}T19:00:00+03:00` },
    end: { dateTime: `${next}T20:00:00+03:00` },
  })
  expect(await sync()).toMatchObject({ inbox: [] })
  expect(google.event(instance)?.status).toBe('cancelled')
  const after = await readPlan()
  const single = after.events.find((e) => e.start === `${next}T19:00`)
  expect(single && google.event(idOf(single))).toMatchObject({ summary: repeat.title, status: 'confirmed' })
})

test('a change made in the app reaches Google, even after Google expired the sync tokens', async () => {
  const session = itemAt(await sessions(), 5)
  const plan = await readPlan()
  const calendar = itemAt(plan.calendars)
  // Expired before the save, whose round is the one that meets it.
  google.expired = true
  await save([
    { type: 'event.patch', uid: session.uid, patch: { title: 'Новое название' } },
    { type: 'calendar.save', id: calendar.id, name: 'Переименован', color: calendar.color },
  ])
  const round = await sync()
  google.expired = false
  expect(round).toMatchObject({ error: null, inbox: [] })
  expect(google.event(idOf(session))?.summary).toBe('Новое название')
  expect([...google.calendars.values()]).toContain('Переименован')
})

test('a Calendar API turned off in the Cloud project is named as such', async () => {
  google.apiOff = true
  await save([{ type: 'event.patch', uid: itemAt(await sessions(), 6).uid, patch: { title: 'Без API' } }])
  expect(await sync()).toMatchObject({ error: 'api-off' })
  google.apiOff = false
  expect(await sync()).toMatchObject({ error: null })
})

test('a sign-in Google no longer takes asks to connect again', async () => {
  google.revoked = true
  await save([{ type: 'event.patch', uid: itemAt(await sessions(), 6).uid, patch: { title: 'Ещё одно' } }])
  expect(await sync()).toMatchObject({ error: 'reconnect', connectedAt: null })
  google.revoked = false
})

test('a sign-in without access to the calendars does not count as connected', async () => {
  google.granted = 'openid'
  const address = value(await calendars.connectAddress(actor, 'google', CALLBACK))
  const state = new URL(address).searchParams.get('state')
  expect(await calendars.finishConnect(actor, 'google', 'code', state ?? '')).toEqual({ ok: false, error: 'scope' })
  expect(await status()).toMatchObject({ connectedAt: null })
  google.granted = GOOGLE_SCOPE
})
