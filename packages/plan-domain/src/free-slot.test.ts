import { expect, test } from 'vitest'

import { DAY, HOUR, parseLocal, startOfDay, weekday, ymd } from './dates'
import { fixtureNow, fixturePlan } from './fixtures'
import { nextFreeSlot } from './free-slot'
import { occurrences } from './occurrences'

const clashes = (slot: { s: number; e: number }) =>
  occurrences(fixturePlan, startOfDay(slot.s), startOfDay(slot.s) + DAY, new Set()).filter(
    (o) => !o.allDay && o.availability !== 'free' && o.s < slot.e && slot.s < o.e,
  )

test('the slot is in the future, on a study day and clear of busy events', () => {
  const slot = nextFreeSlot(fixturePlan, { from: fixtureNow, length: HOUR })
  expect(slot).not.toBeNull()
  if (!slot) return
  expect(slot.s).toBeGreaterThanOrEqual(fixtureNow)
  expect(slot.e - slot.s).toBe(HOUR)
  expect(weekday(slot.s) % 6).not.toBe(0)
  expect(fixturePlan.meta.holidays).not.toContain(ymd(slot.s))
  expect(clashes(slot)).toEqual([])
})

test('the preferred hour wins when it is free, and the own calendar blocks a slot', () => {
  const plain = nextFreeSlot(fixturePlan, { from: fixtureNow, length: HOUR, preferHour: 19 })
  expect(plain && new Date(plain.s).getUTCHours()).toBe(19)
  if (!plain) return
  const around = nextFreeSlot(fixturePlan, {
    from: fixtureNow,
    length: HOUR,
    preferHour: 19,
    busy: [{ title: 'Call', s: plain.s - HOUR, e: plain.e + HOUR }],
  })
  expect(around?.s).not.toBe(plain.s)
})

test('nothing is offered when no day has room', () => {
  const from = parseLocal('2026-12-05T00:00')
  expect(nextFreeSlot(fixturePlan, { from, length: HOUR, days: 2 })).toBeNull()
})
