import { expect, test } from 'vitest'

import { fixturePlan, itemAt } from './fixtures'
import { calendarICS, icsETag } from './ics'
import { isSession } from './progress'
import { reviseEvents } from './revisions'

const session = itemAt(fixturePlan.events.filter((e) => isSession(e) && !e.done))
const calendar = itemAt(fixturePlan.calendars.filter((c) => c.id === session.calendar))
const T0 = Date.UTC(2026, 10, 23, 9, 40)
const T1 = T0 + 60_000

test('a new event starts at 0 and every change a subscriber would see counts one up', () => {
  const first = reviseEvents({}, fixturePlan.events, T0)
  expect(first[session.uid]).toMatchObject({ seq: 0, modified: T0 })
  expect(reviseEvents(first, fixturePlan.events, T1)).toEqual(first)
  const moved = reviseEvents(first, [{ ...session, start: `${session.start.slice(0, 11)}06:00` }], T1)
  expect(moved[session.uid]).toMatchObject({ seq: 1, modified: T1 })
  const done = reviseEvents(moved, [{ ...session, done: true }], T1 + 1)
  expect(done[session.uid]?.seq).toBe(2)
})

test('the row of a removed event stays, so a restored one goes on counting up', () => {
  const first = reviseEvents({}, [session], T0)
  const without = reviseEvents(first, [], T1)
  expect(without[session.uid]).toEqual(first[session.uid])
  expect(reviseEvents(without, [{ ...session, title: 'Back' }], T1)[session.uid]?.seq).toBe(1)
})

test('the feed carries the version of each event, and its validator ignores when it was written', () => {
  const revisions = reviseEvents({}, fixturePlan.events, T0)
  const ics = calendarICS(fixturePlan, calendar, { revisions })
  expect(ics).toContain('SEQUENCE:0\r\nLAST-MODIFIED:20261123T094000Z')
  const later = ics.replace(/^DTSTAMP:.*$/m, 'DTSTAMP:20991231T000000Z')
  expect(icsETag(later)).toBe(icsETag(ics))
  expect(icsETag(ics.replace('SEQUENCE:0', 'SEQUENCE:1'))).not.toBe(icsETag(ics))
})

test('a finished session says how long it really took, before its notes', () => {
  const finished = { ...session, done: true, actual: 75 }
  const plan = { ...fixturePlan, events: [finished] }
  const ics = calendarICS(plan, calendar, { markDone: true })
  expect(ics).toMatch(/DESCRIPTION:✓ 1:15 \/ \d+:\d\d\\n\\n/)
  expect(calendarICS(plan, calendar)).not.toContain('DESCRIPTION:✓')
})
