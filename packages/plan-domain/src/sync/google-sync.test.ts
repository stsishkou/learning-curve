import { expect, test } from 'vitest'

import { isSession } from '../core/progress'
import { fixturePlan, itemAt } from '../fixtures'
import { writtenOf } from './calendar-sync'
import { googleBody, googleEventId, remoteOfGoogle, uidOfGoogleId, wallOf } from './google-sync'

const TZ = fixturePlan.meta.timezone
const session = itemAt(fixturePlan.events.filter((e) => isSession(e) && !e.done))
const repeat = itemAt(fixturePlan.events.filter((e) => e.rrule))

test('an event id is the uid in base32hex, and goes back to it', () => {
  expect(googleEventId('certs-001@learning-curve')).toBe('cdin4t3j5ko30ca0dhim2sjed5n6ebb3elp7cp8')
  for (const e of fixturePlan.events) {
    const id = googleEventId(e.uid)
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/)
    expect(uidOfGoogleId(id)).toBe(e.uid)
  }
  expect(uidOfGoogleId('Abc_20261201T110000Z')).toBeNull()
})

test('a done session goes to Google as free time, on the plan clock; a repeat skips its days', () => {
  const body = googleBody(session.uid, writtenOf({ ...session, done: true }), TZ)
  expect(body).toMatchObject({
    id: googleEventId(session.uid),
    summary: `✓ ${session.title}`,
    transparency: 'transparent',
  })
  expect(body.start).toEqual({ dateTime: `${session.start}:00`, timeZone: TZ })
  const skipped = googleBody(repeat.uid, writtenOf({ ...repeat, skip: ['2026-12-08'] }), TZ)
  expect(skipped.recurrence).toEqual([
    `RRULE:${repeat.rrule}`,
    `EXDATE;TZID=${TZ}:20261208T${repeat.start.slice(11, 13)}${repeat.start.slice(14, 16)}00`,
  ])
})

test('a time without an offset is read on its own clock, whatever the zone of the machine', () => {
  expect(wallOf({ dateTime: '2026-12-01T18:30:00', timeZone: TZ })).toBe('2026-12-01T18:30')
  expect(wallOf({ dateTime: '2026-12-01T15:30:00Z' })).toBe('2026-12-01T18:30')
  expect(wallOf({ date: '2026-12-01' })).toBe('2026-12-01')
})

test('an event read from Google names its plan event, and a repeat its day', () => {
  const body = googleBody(session.uid, writtenOf(session), TZ)
  expect(remoteOfGoogle({ ...body, etag: '"e"', status: 'confirmed' })).toEqual({
    id: body.id,
    uid: session.uid,
    etag: '"e"',
    cancelled: false,
    summary: session.title,
    start: session.start,
    end: session.end,
    day: undefined,
  })
  const series = googleEventId(repeat.uid)
  const cancelled = {
    id: `${series}_20261208T053000Z`,
    status: 'cancelled',
    recurringEventId: series,
    originalStartTime: { dateTime: '2026-12-08T08:30:00+03:00' },
  }
  expect(remoteOfGoogle(cancelled)).toMatchObject({ uid: repeat.uid, cancelled: true, day: '2026-12-08' })
  expect(remoteOfGoogle({ ...cancelled, originalStartTime: {} })).toBeNull()
})
