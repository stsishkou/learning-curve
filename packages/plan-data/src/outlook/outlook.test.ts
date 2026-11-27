import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { addDays, emptyEdits, historyEdits, isSession, travel, type PlanEvent } from '@lc/plan-domain'
import { itemAt } from '@lc/plan-domain/fixtures'
import { parseCalendarSync } from '@lc/plan-domain/sync'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'

import { FakeOutlook } from './fake-outlook'

const dir = mkdtempSync(join(tmpdir(), 'lc-outlook-'))
const outlook = new FakeOutlook()
const CALLBACK = 'http://localhost:3000/api/outlook/callback'

// The store finds its files when it is first imported, so the modules are loaded after the directory is set.
const load = async () => ({
  ...(await import('../store')),
  ...(await import('../calendar-sync/oauth')),
  ...(await import('../calendar-sync/engine')),
})
let lib: Awaited<ReturnType<typeof load>>

beforeAll(async () => {
  vi.stubEnv('PLAN_DATA_DIR', dir)
  vi.stubEnv('OUTLOOK_CLIENT_ID', '')
  vi.stubEnv('OUTLOOK_CLIENT_SECRET', '')
  vi.stubGlobal('fetch', outlook.fetch)
  lib = await load()
  lib.writePlan(emptyEdits())
})

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
})

const sync = () => lib.syncCalendar('outlook')
const planEvent = (uid: string) => lib.readPlan().events.find((e) => e.uid === uid)
const sessions = () => lib.readPlan().events.filter((e) => isSession(e) && !e.done && !e.rrule)
const day = (event: PlanEvent) => event.start.slice(0, 10)
/** The Outlook id the sync keeps for a plan event. */
const idOf = (event: PlanEvent) => parseCalendarSync(lib.readSync().outlook).events[event.uid]?.id ?? ''
const at = (wall: string) => ({ dateTime: `${wall}:00.0000000`, timeZone: 'Belarus Standard Time' })

function undo(steps: number) {
  const history = travel(lib.currentHistory(), lib.currentHistory().cursor - steps)
  lib.writePlan(historyEdits(history))
  lib.writeHistory(history)
}

test('connecting asks Microsoft for the calendars and a refresh token, and keeps the one it hands out', async () => {
  expect(lib.calendarStatus('outlook')).toMatchObject({ configured: false, connectedAt: null })
  lib.saveCalendarClient('outlook', ' 00000000-aaaa-bbbb-cccc-000000000000 ', 'secret')
  const address = new URL(lib.connectAddress('outlook', CALLBACK))
  expect(address.origin + address.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
  expect(address.searchParams.get('scope')).toBe('offline_access https://graph.microsoft.com/Calendars.ReadWrite')
  expect(address.searchParams.get('prompt')).toBe('select_account')
  await lib.finishConnect('outlook', 'code', address.searchParams.get('state') ?? '')
  const verifier = outlook.exchanged.code_verifier ?? ''
  expect(createHash('sha256').update(verifier).digest('base64url')).toBe(address.searchParams.get('code_challenge'))
  expect(outlook.exchanged).toMatchObject({ redirect_uri: CALLBACK, client_secret: 'secret' })
  expect(lib.calendarStatus('outlook').connectedAt).toBeTypeOf('number')
})

test('the first round writes every calendar and event, the days a repeat skips cancelled; the next writes nothing', async () => {
  const plan = lib.readPlan()
  const repeat = itemAt(plan.events.filter((e) => e.rrule))
  lib.saveChanges([{ type: 'event.patch', uid: repeat.uid, patch: { skip: [addDays(day(repeat), 2)] } }])
  const status = await sync()
  expect(status.error).toBeNull()
  expect([...outlook.calendars.values()]).toEqual(plan.calendars.map((c) => c.name))
  expect(outlook.live()).toHaveLength(plan.events.length)
  expect(outlook.exceptions.get(idOf(repeat))?.get(addDays(day(repeat), 2))).toBe('cancelled')
  // Microsoft handed out a new refresh token with the access token; the old one is spent.
  expect(lib.readLocal()).toMatchObject({ outlook: { refreshToken: outlook.refresh } })

  const writes = outlook.writes
  expect(await sync()).toMatchObject({ inbox: [], error: null, events: plan.events.length })
  expect(outlook.writes).toBe(writes)
})

test('a ✓ typed and a move made in Outlook go into the plan by themselves', async () => {
  const [ticked, moved] = [itemAt(sessions()), itemAt(sessions(), 1)]
  outlook.edit(idOf(ticked), { subject: `✓ ${ticked.title}` })
  outlook.edit(idOf(moved), { start: at(`${day(moved)}T06:00`), end: at(`${day(moved)}T07:00`) })
  const status = await sync()
  expect(status).toMatchObject({ inbox: [], error: null })
  expect(planEvent(ticked.uid)?.done).toBe(true)
  expect(planEvent(moved.uid)).toMatchObject({ start: `${day(moved)}T06:00`, end: `${day(moved)}T07:00` })
  expect(lib.currentHistory().steps.at(-1)?.source).toBe('outlook')
  expect(outlook.event(idOf(ticked))).toMatchObject({ showAs: 'free' })
})

test('a session deleted in Outlook goes to the trash; Undo writes it again', async () => {
  const trashed = itemAt(sessions(), 2)
  const id = idOf(trashed)
  outlook.remove(id)
  expect(await sync()).toMatchObject({ inbox: [] })
  expect(planEvent(trashed.uid)).toBeUndefined()

  undo(1)
  await sync()
  expect(idOf(trashed)).not.toBe(id)
  expect(outlook.event(idOf(trashed))).toMatchObject({ subject: trashed.title })
})

test('a repeat cancelled in Outlook skips that day; one moved there becomes an event of its own', async () => {
  const repeat = itemAt(lib.readPlan().events.filter((e) => e.rrule))
  const series = idOf(repeat)
  const first = day(repeat)
  outlook.repeat(series, first, 'cancelled')
  expect(await sync()).toMatchObject({ inbox: [], error: null })
  expect(planEvent(repeat.uid)?.skip).toContain(first)

  const next = addDays(first, 7)
  outlook.repeat(idOf(repeat), next, { start: at(`${next}T19:00`), end: at(`${next}T20:00`) })
  expect(await sync()).toMatchObject({ inbox: [], error: null })
  expect(planEvent(repeat.uid)?.skip).toContain(next)
  const single = lib.readPlan().events.find((e) => e.start === `${next}T19:00`)
  expect(single && outlook.event(idOf(single))).toMatchObject({ subject: repeat.title })
  expect(outlook.exceptions.get(idOf(repeat))?.get(next)).toBe('cancelled')
})

test('an event moved to another calendar in the planner is written there and deleted from the old one', async () => {
  const session = itemAt(sessions(), 3)
  const elsewhere = itemAt(lib.readPlan().calendars.filter((c) => c.id !== session.calendar))
  const before = idOf(session)
  lib.saveChanges([{ type: 'event.patch', uid: session.uid, patch: { calendar: elsewhere.id } }])
  expect(await sync()).toMatchObject({ error: null })
  expect(outlook.event(before)).toBeUndefined()
  const target = [...outlook.calendars].find(([, name]) => name === elsewhere.name)?.[0]
  expect(outlook.stored.get(idOf(session))?.calendar).toBe(target)
})

test('an edit to what the planner changed too waits; keeping the plan writes it over Outlook', async () => {
  const kept = itemAt(sessions(), 4)
  lib.saveChanges([
    { type: 'event.patch', uid: kept.uid, patch: { start: `${day(kept)}T20:00`, end: `${day(kept)}T21:00` } },
  ])
  outlook.edit(idOf(kept), { start: at(`${day(kept)}T06:00`), end: at(`${day(kept)}T07:00`) })
  const status = await sync()
  expect(status.inbox).toMatchObject([{ uid: kept.uid, hold: 'both' }])
  await lib.rejectProposals(
    'outlook',
    status.inbox.map((item) => item.id),
  )
  expect(outlook.event(idOf(kept))?.start).toMatchObject({ dateTime: `${day(kept)}T20:00:00` })
  expect(lib.calendarStatus('outlook').inbox).toEqual([])
})

test('an account without a mailbox, and a sign-in Microsoft no longer takes, are named as such', async () => {
  const calendars = outlook.calendars.size
  outlook.noMailbox = true
  lib.saveChanges([{ type: 'event.patch', uid: itemAt(sessions(), 5).uid, patch: { title: 'Без почты' } }])
  expect(await sync()).toMatchObject({ error: 'mailbox' })
  outlook.noMailbox = false
  expect(await sync()).toMatchObject({ error: null })
  // The calendars it could not reach were not taken for deleted, and are not made twice.
  expect(outlook.calendars.size).toBe(calendars)

  outlook.revoked = true
  lib.saveChanges([{ type: 'event.patch', uid: itemAt(sessions(), 5).uid, patch: { title: 'Без доступа' } }])
  expect(await sync()).toMatchObject({ error: 'reconnect', connectedAt: null })
  outlook.revoked = false
})
