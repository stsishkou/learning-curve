import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { addDays, emptyEdits, googleEventId, isSession, type PlanEvent } from '@lc/plan-domain'
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

test('a ✓ typed in Google waits for the person, and once accepted is written back as the plan has it', async () => {
  const session = itemAt(sessions())
  google.edit(idOf(session), { summary: `✓ ${session.title}` })
  const status = await lib.syncGoogle()
  expect(status.inbox).toMatchObject([{ uid: session.uid, change: { type: 'events.done', done: true } }])

  const accepted = await lib.acceptGoogle(status.inbox.map((item) => item.id))
  expect(accepted.inbox).toEqual([])
  expect(planEvent(session.uid)?.done).toBe(true)
  expect(google.event(idOf(session))).toMatchObject({ summary: `✓ ${session.title}`, transparency: 'transparent' })
  const writes = google.writes
  await lib.syncGoogle()
  expect(google.writes).toBe(writes)
})

test('a move kept out is put back; a title typed over is written back without asking', async () => {
  const [moved, renamed] = [itemAt(sessions(), 1), itemAt(sessions(), 2)]
  google.edit(idOf(moved), {
    start: { dateTime: `${day(moved)}T06:00:00+03:00` },
    end: { dateTime: `${day(moved)}T07:00:00+03:00` },
  })
  google.edit(idOf(renamed), { summary: 'Lunch' })
  const status = await lib.syncGoogle()
  expect(status.inbox).toMatchObject([
    { uid: moved.uid, change: { type: 'event.patch', patch: { start: `${day(moved)}T06:00` } } },
  ])
  expect(google.event(idOf(renamed))?.summary).toBe(renamed.title)

  await lib.rejectGoogle(status.inbox.map((item) => item.id))
  expect(planEvent(moved.uid)?.start).toBe(moved.start)
  expect(google.event(idOf(moved))?.start).toEqual({ dateTime: `${moved.start}:00`, timeZone: 'Europe/Minsk' })
})

test('a session deleted in Google is put back, or goes to the trash when the person agrees', async () => {
  const [kept, trashed] = [itemAt(sessions(), 3), itemAt(sessions(), 4)]
  google.edit(idOf(kept), { status: 'cancelled' })
  google.edit(idOf(trashed), { status: 'cancelled' })
  const status = await lib.syncGoogle()
  const item = (uid: string) => status.inbox.filter((i) => i.uid === uid).map((i) => i.id)
  expect(status.inbox).toMatchObject([{ change: null }, { change: null }])

  await lib.rejectGoogle(item(kept.uid))
  expect(google.event(idOf(kept))?.status).toBe('confirmed')
  await lib.acceptGoogle(item(trashed.uid))
  expect(planEvent(trashed.uid)).toBeUndefined()
  expect(lib.readEdits().removed.events[trashed.uid]).toBeTypeOf('string')
  expect(google.event(idOf(trashed))?.status).toBe('cancelled')
})

test('a repeat deleted in Google skips that day; one moved there becomes an event of its own', async () => {
  const repeat = itemAt(lib.readPlan().events.filter((e) => e.rrule))
  const series = idOf(repeat)
  google.repeat(series, repeat.start, { status: 'cancelled' })
  const status = await lib.syncGoogle()
  expect(status.inbox).toMatchObject([{ day: day(repeat), change: { patch: { skip: [day(repeat)] } } }])
  await lib.acceptGoogle(status.inbox.map((item) => item.id))
  expect(planEvent(repeat.uid)?.skip).toEqual([day(repeat)])
  const exdate = `EXDATE;TZID=Europe/Minsk:${day(repeat).replaceAll('-', '')}T${repeat.start.slice(11).replace(':', '')}00`
  expect(google.event(series)?.recurrence).toEqual([`RRULE:${repeat.rrule}`, exdate])

  const next = addDays(day(repeat), 7)
  const instance = google.repeat(series, `${next}${repeat.start.slice(10)}`, {
    start: { dateTime: `${next}T19:00:00+03:00` },
    end: { dateTime: `${next}T20:00:00+03:00` },
  })
  const moved = await lib.syncGoogle()
  expect(moved.inbox).toMatchObject([{ change: { type: 'event.detach', day: next, start: `${next}T19:00` } }])
  await lib.acceptGoogle(moved.inbox.map((item) => item.id))
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

test('a sign-in Google no longer takes asks to connect again', async () => {
  google.revoked = true
  lib.saveChanges([{ type: 'event.patch', uid: itemAt(sessions(), 6).uid, patch: { title: 'Ещё одно' } }])
  expect(await lib.syncGoogle()).toMatchObject({ error: 'reconnect', connectedAt: null })
  google.revoked = false
})
