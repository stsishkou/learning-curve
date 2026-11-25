import { describe, expect, it } from 'vitest'

import { finishRecord, likelyLength, longRun, loggedMinutes } from './finish'

const MINUTE = 60_000
/** 2026-11-26 14:03:40 in Minsk */
const BEGAN = Date.UTC(2026, 10, 26, 11, 3, 40)

it('logs whole minutes, not quarter hours', () => {
  expect(loggedMinutes(67.4 * MINUTE)).toBe(67)
  expect(loggedMinutes(67.6 * MINUTE)).toBe(68)
})

it('logs no less than 5 minutes and no more than a day, as a session may take', () => {
  expect(loggedMinutes(20_000)).toBe(5)
  expect(loggedMinutes(30 * 60 * MINUTE)).toBe(24 * 60)
})

it('keeps the first start in Minsk time and the minutes the stopwatch stood', () => {
  expect(finishRecord(68 * MINUTE, BEGAN, BEGAN + 75 * MINUTE)).toEqual({
    actual: 68,
    began: '2026-11-26T14:03',
    paused: 7,
  })
})

it('a stopwatch that never stood has no pause, whatever the seconds', () => {
  expect(finishRecord(68 * MINUTE, BEGAN, BEGAN + 68 * MINUTE + 20_000).paused).toBe(0)
})

it('expects the plan times what sessions like it took, to five minutes', () => {
  expect(likelyLength(60 * MINUTE, 1.25)).toBe(75 * MINUTE)
  expect(likelyLength(60 * MINUTE, 1.22)).toBe(75 * MINUTE)
  expect(likelyLength(120 * MINUTE, 0.83)).toBe(100 * MINUTE)
})

describe('longRun', () => {
  const HOUR = 60 * MINUTE

  it('lets a run up to twice the plan through without a question', () => {
    expect(longRun(2 * HOUR, HOUR, BEGAN, BEGAN + 2 * HOUR)).toBeNull()
  })

  it('asks about a run longer than twice the plan: a stopwatch left running looks like this', () => {
    expect(longRun(2 * HOUR + MINUTE, HOUR, BEGAN, BEGAN + 2 * HOUR + MINUTE)).toEqual({ overnight: false })
  })

  it('asks about a run that went past midnight in Minsk, however short', () => {
    // 23:40 to 00:20 in Minsk
    const late = Date.UTC(2026, 10, 26, 20, 40)
    expect(longRun(40 * MINUTE, HOUR, late, late + 40 * MINUTE)).toEqual({ overnight: true })
  })
})
