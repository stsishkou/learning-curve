import { describe, expect, test } from 'vitest'

import { stackSlots } from './strip'

describe('stackSlots', () => {
  test('dots apart from each other stay on the middle line', () => {
    expect(stackSlots([10, 40, 80], 10)).toEqual([0, 0, 0])
  })

  test('dots that would overlap stack above and below, alternating', () => {
    expect(stackSlots([50, 50, 50, 52], 10)).toEqual([0, -1, 1, -2])
  })
})
