import { describe, expect, test } from 'vitest'

import { logDomain, ratioTicks, stackSlots } from './strip'

describe('logDomain', () => {
  test('reaches ×0.5 and ×2 at least, the same distance either side of the plan', () => {
    const { lo, hi } = logDomain([1.1, 0.9])
    expect(lo).toBeLessThanOrEqual(0.5)
    expect(hi).toBeGreaterThanOrEqual(2)
    expect(lo * hi).toBeCloseTo(1)
  })

  test('widens past the farthest ratio on either side, so its dot is not cut', () => {
    const { lo, hi } = logDomain([3, 1])
    expect(hi).toBeGreaterThan(3)
    expect(lo).toBeLessThan(1 / 3)
  })
})

test('ticks fall inside the domain and always include the plan', () => {
  expect(ratioTicks(0.45, 2.2)).toEqual([0.5, 2 / 3, 1, 1.5, 2])
  expect(ratioTicks(0.3, 3.3)).toContain(3)
})

describe('stackSlots', () => {
  test('dots apart from each other stay on the middle line', () => {
    expect(stackSlots([10, 40, 80], 10)).toEqual([0, 0, 0])
  })

  test('dots that would overlap stack above and below, alternating', () => {
    expect(stackSlots([50, 50, 50, 52], 10)).toEqual([0, -1, 1, -2])
  })
})
