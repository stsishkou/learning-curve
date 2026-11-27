import { describe, expect, test } from 'vitest'

import { parseLocal } from '../core/dates'
import type { PlanEvent } from '../core/types'
import { placeDay } from './placement'
import { HALF_HOUR, type Room, type RoomDay } from './room'

const session = (n: number, start: string, end: string, kind: PlanEvent['kind'] = 'study'): PlanEvent => ({
  uid: `s${n}`,
  calendar: 'c',
  title: `Course — Part ${n}`,
  start,
  end,
  description: '',
  kind,
  availability: 'busy',
})

/** 7 December with free half hours from `from` to `to` */
function day(from: string, to: string): RoomDay {
  const slots: number[] = []
  for (let t = parseLocal(`2026-12-07T${from}`); t < parseLocal(`2026-12-07T${to}`); t += HALF_HOUR) slots.push(t)
  return { day: '2026-12-07', week: '2026-12-07', index: 1, slots, cap: slots.length / 2, lab: slots.length >= 4 }
}

const ownOf = (...events: PlanEvent[]): Room['own'] =>
  new Map(
    events.map((e) => [
      e.uid,
      { day: e.start.slice(0, 10), start: parseLocal(e.start), end: parseLocal(e.end), outside: false },
    ]),
  )

describe('placeDay', () => {
  test('keeps a session in its own slot when the rest of the day still fits after it', () => {
    const first = session(1, '2026-12-07T11:00', '2026-12-07T12:00')
    const second = session(2, '2026-12-09T13:00', '2026-12-09T14:00')
    const { placed, failed } = placeDay(day('11:00', '14:00'), [first, second], new Map(), ownOf(first, second))
    expect(failed).toEqual([])
    expect(placed.map((p) => p.start)).toEqual(['2026-12-07T11:00', '2026-12-07T12:00'])
  })

  test('leaves its own slot when keeping it would leave no room for the sessions after it', () => {
    const first = session(1, '2026-12-07T13:00', '2026-12-07T14:00')
    const second = session(2, '2026-12-08T11:00', '2026-12-08T12:00')
    const { placed, failed } = placeDay(day('11:00', '14:00'), [first, second], new Map(), ownOf(first, second))
    expect(failed).toEqual([])
    const [a, b] = placed
    expect(a && b && a.end <= b.start).toBe(true)
  })

  test('fits a lab after a session when only the order makes it fit', () => {
    const first = session(1, '2026-12-07T13:00', '2026-12-07T14:00')
    const lab = session(2, '2026-12-08T11:00', '2026-12-08T13:00', 'lab')
    const { placed, failed } = placeDay(day('11:00', '14:00'), [first, lab], new Map(), ownOf(first, lab))
    expect(failed).toEqual([])
    expect(placed.map((p) => p.start)).toEqual(['2026-12-07T11:00', '2026-12-07T12:00'])
  })

  test('refuses what free time cannot hold in order, never squeezing it in', () => {
    const first = session(1, '2026-12-08T11:00', '2026-12-08T13:00', 'lab')
    const second = session(2, '2026-12-09T11:00', '2026-12-09T13:00', 'lab')
    const { placed, failed } = placeDay(day('11:00', '14:00'), [first, second], new Map(), ownOf(first, second))
    expect(placed.map((p) => p.uid)).toEqual(['s1'])
    expect(failed.map((e) => e.uid)).toEqual(['s2'])
  })
})
