import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { addDays, emptyEdits, googleEventId, historyEdits, isSession, travel, type PlanEvent } from '@lc/plan-domain'
import { itemAt } from '@lc/plan-domain/fixtures'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'

import { FakeGoogle } from './fake-google'

const dir = mkdtempSync(join(tmpdir(), 'lc-google-'))
const google = new FakeGoogle()

// The store finds its files when it is first imported, so the modules are loaded after the directory is set.
const load = async () => ({
  ...(await import('../store')),
  ...(await import('./oauth')),
  ...(await import('./engine')),
})
let lib: Awaited<ReturnType<typeof load>>

beforeAll(async () => {
  vi.stubEnv('PLAN_DATA_DIR', dir)
  vi.stubEnv('GOOGLE_CLIENT_ID', '')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
  vi.stubGlobal('fetch', google.fetch)
  lib = await load()
  lib.writePlan(emptyEdits())
})

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
})

const planEvent = (uid: string) => lib.readPlan().events.find((e) => e.uid === uid)
const sessions = () => lib.readPlan().events.filter((e) => isSession(e) && !e.done)
const idOf = (event: PlanEvent) => googleEventId(event.uid)
const day = (event: PlanEvent) => event.start.slice(0, 10)

test('connecting keeps a refresh token that only the owner can read', async () => {
  expect(lib.googleStatus()).toMatchObject({ configured: false, connectedAt: null })
  expect(() => lib.connectAddress('http://localhost:3000/api/google/callback')).toThrow()
  lib.saveGoogleClient(' client.apps.googleusercontent.com ', 'secret ')
  const address = new URL(lib.connectAddress('http://localhost:3000/api/google/callback'))
  expect(address.searchParams.get('scope')).toBe(lib.GOOGLE_SCOPE)
  expect(address.searchParams.get('client_id')).toBe('client.apps.googleusercontent.com')
  const state = address.searchParams.get('state') ?? ''
  await expect(lib.finishConnect('code', 'another')).rejects.toThrow('state')

  await lib.finishConnect('code', state)
  const verifier = google.exchanged.code_verifier ?? ''
  expect(createHash('sha256').update(verifier).digest('base64url')).toBe(address.searchParams.get('code_challenge'))
  expect(google.exchanged).toMatchObject({ redirect_uri: 'http://localhost:3000/api/google/callback', code: 'code' })
  const local = join(dir, 'local.json')
  expect(JSON.parse(readFileSync(local, 'utf8'))).toMatchObject({ google: { refreshToken: 'refresh' } })
  expect(statSync(local).mode & 0o777).toBe(0o600)
  expect(lib.googleStatus().configured).toBe(true)
  expect(lib.googleStatus().connectedAt).toBeTypeOf('number')
  await expect(lib.finishConnect('code', state)).rejects.toThrow('state')
})

test('the first round makes a calendar for each plan calendar and writes every event; the next writes nothing', async () => {
  const plan = lib.readPlan()
  const status = await lib.syncGoogle()
  expect(status.error).toBeNull()
  expect([...google.calendars.values()]).toEqual(plan.calendars.map((c) => c.name))
  expect(google.live()).toHaveLength(plan.events.length)
  const repeat = itemAt(plan.events.filter((e) => e.rrule))
  expect(google.event(idOf(repeat))).toMatchObject({ recurrence: [`RRULE:${repeat.rrule}`] })

  const writes = google.writes
  expect(await lib.syncGoogle()).toMatchObject({ inbox: [], error: null, events: plan.events.length })
  expect(google.writes).toBe(writes)
})

/** Undo as the planner does it: the plan goes back `steps` steps, and the next round writes it to Google. */
function undo(steps: number) {
  const history = travel(lib.currentHistory(), lib.currentHistory().cursor - steps)
  lib.writePlan(historyEdits(history))
  lib.writeHistory(history)
}

const slot = (event: PlanEvent, from: string, to: string) => ({
  start: { dateTime: `${day(event)}T${from}:00+03:00` },
  end: { dateTime: `${day(event)}T${to}:00+03:00` },
})

test('a ✓ typed in Google marks the session done by itself, as a step of the history', async () => {
  const session = itemAt(sessions())
  google.edit(idOf(session), { summary: `✓ ${session.title}` })
  const status = await lib.syncGoogle()
  expect(status).toMatchObject({ inbox: [], error: null })
  expect(status.takenAt).toBeTypeOf('number')
  expect(planEvent(session.uid)?.done).toBe(true)
  expect(lib.currentHistory().steps.at(-1)).toMatchObject({ source: 'google', subject: session.title })
  expect(google.event(idOf(session))).toMatchObject({ summary: `✓ ${session.title}`, transparency: 'transparent' })
  const writes = google.writes
  await lib.syncGoogle()
  expect(google.writes).toBe(writes)
})

test('a move and a new title made in Google go into the plan, and Undo writes the plan back', async () => {
  const [moved, renamed] = [itemAt(sessions(), 1), itemAt(sessions(), 2)]
  google.edit(idOf(moved), slot(moved, '06:00', '07:00'))
  google.edit(idOf(renamed), { summary: 'Lunch' })
  expect(await lib.syncGoogle()).toMatchObject({ inbox: [] })
  expect(planEvent(moved.uid)).toMatchObject({ start: `${day(moved)}T06:00`, end: `${day(moved)}T07:00` })
  expect(planEvent(renamed.uid)?.title).toBe('Lunch')

  undo(2)
  await lib.syncGoogle()
  expect(google.event(idOf(moved))?.start).toEqual({ dateTime: `${moved.start}:00`, timeZone: 'Europe/Minsk' })
  expect(google.event(idOf(renamed))?.summary).toBe(renamed.title)
})

test('an edit to what the planner changed too waits, and is left alone in Google until decided', async () => {
  const [kept, taken] = [itemAt(sessions(), 3), itemAt(sessions(), 4)]
  // Changed in the planner, and in Google before the planner's change was sent.
  lib.saveChanges(
    [kept, taken].map((e) => ({
      type: 'event.patch',
      uid: e.uid,
      patch: { start: `${day(e)}T20:00`, end: `${day(e)}T21:00` },
    })),
  )
  google.edit(idOf(kept), slot(kept, '06:00', '07:00'))
  google.edit(idOf(taken), slot(taken, '06:00', '07:00'))
  const status = await lib.syncGoogle()
  expect(status.inbox).toMatchObject([{ hold: 'both' }, { hold: 'both' }])
  expect(google.event(idOf(kept))?.start).toEqual(slot(kept, '06:00', '07:00').start)

  const of = (event: PlanEvent) => status.inbox.filter((item) => item.uid === event.uid).map((item) => item.id)
  await lib.rejectGoogle(of(kept))
  expect(google.event(idOf(kept))?.start).toEqual({ dateTime: `${day(kept)}T20:00:00`, timeZone: 'Europe/Minsk' })
  expect(await lib.acceptGoogle(of(taken))).toMatchObject({ inbox: [] })
  expect(planEvent(taken.uid)?.start).toBe(`${day(taken)}T06:00`)
})

test('a session deleted in Google goes to the trash, and Undo brings it back there too', async () => {
  const trashed = itemAt(sessions(), 5)
  google.edit(idOf(trashed), { status: 'cancelled' })
  expect(await lib.syncGoogle()).toMatchObject({ inbox: [] })
  expect(planEvent(trashed.uid)).toBeUndefined()
  expect(lib.readEdits().removed.events[trashed.uid]).toBeTypeOf('string')

  undo(1)
  await lib.syncGoogle()
  expect(google.event(idOf(trashed))?.status).toBe('confirmed')
})

test('a repeat deleted in Google skips that day; one moved there becomes an event of its own', async () => {
  const repeat = itemAt(lib.readPlan().events.filter((e) => e.rrule))
  const series = idOf(repeat)
  google.repeat(series, repeat.start, { status: 'cancelled' })
  expect(await lib.syncGoogle()).toMatchObject({ inbox: [] })
  expect(planEvent(repeat.uid)?.skip).toEqual([day(repeat)])
  const exdate = `EXDATE;TZID=Europe/Minsk:${day(repeat).replaceAll('-', '')}T${repeat.start.slice(11).replace(':', '')}00`
  expect(google.event(series)?.recurrence).toEqual([`RRULE:${repeat.rrule}`, exdate])

  const next = addDays(day(repeat), 7)
  const instance = google.repeat(series, `${next}${repeat.start.slice(10)}`, {
    start: { dateTime: `${next}T19:00:00+03:00` },
    end: { dateTime: `${next}T20:00:00+03:00` },
  })
  expect(await lib.syncGoogle()).toMatchObject({ inbox: [] })
  expect(google.event(instance)?.status).toBe('cancelled')
  const single = lib.readPlan().events.find((e) => e.start === `${next}T19:00`)
  expect(single && google.event(idOf(single))).toMatchObject({ summary: repeat.title, status: 'confirmed' })
})

test('a change made in the app reaches Google, even after Google expired the sync tokens', async () => {
  const session = itemAt(sessions(), 5)
  const calendar = itemAt(lib.readPlan().calendars)
  lib.saveChanges([
    { type: 'event.patch', uid: session.uid, patch: { title: 'Новое название' } },
    { type: 'calendar.save', id: calendar.id, name: 'Переименован', color: calendar.color },
  ])
  google.expired = true
  const status = await lib.syncGoogle()
  google.expired = false
  expect(status).toMatchObject({ error: null, inbox: [] })
  expect(google.event(idOf(session))?.summary).toBe('Новое название')
  expect([...google.calendars.values()]).toContain('Переименован')
})

test('a Calendar API turned off in the Cloud project is named as such', async () => {
  google.apiOff = true
  lib.saveChanges([{ type: 'event.patch', uid: itemAt(sessions(), 6).uid, patch: { title: 'Без API' } }])
  expect(await lib.syncGoogle()).toMatchObject({ error: 'api-off' })
  google.apiOff = false
  expect(await lib.syncGoogle()).toMatchObject({ error: null })
})

test('a sign-in Google no longer takes asks to connect again', async () => {
  google.revoked = true
  lib.saveChanges([{ type: 'event.patch', uid: itemAt(sessions(), 6).uid, patch: { title: 'Ещё одно' } }])
  expect(await lib.syncGoogle()).toMatchObject({ error: 'reconnect', connectedAt: null })
  google.revoked = false
})

test('a sign-in without access to the calendars does not count as connected', async () => {
  google.granted = 'openid'
  const state = new URL(lib.connectAddress('http://localhost:3000/api/google/callback')).searchParams.get('state')
  await expect(lib.finishConnect('code', state ?? '')).rejects.toMatchObject({ reason: 'scope' })
  expect(lib.googleStatus().connectedAt).toBeNull()
  google.granted = lib.GOOGLE_SCOPE
})
