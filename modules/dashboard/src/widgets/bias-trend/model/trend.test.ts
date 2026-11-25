import { describe, expect, test } from 'vitest'

import { countTicks } from './trend'

describe('countTicks', () => {
  test('marks every session while they fit', () => {
    expect(countTicks(6, 9, 10)).toEqual([6, 7, 8, 9])
  })

  test('steps by a round number once they do not, keeping the first and leaving out a round one too close to it', () => {
    expect(countTicks(6, 40, 5)).toEqual([6, 20, 30, 40])
  })

  test('a single session is a single tick', () => {
    expect(countTicks(6, 6, 5)).toEqual([6])
  })
})
