import { describe, expect, test } from 'vitest'

import { stepIndex } from './chart-keys'

describe('stepIndex', () => {
  test('the arrows move one stop along the chart and stop at its ends', () => {
    expect(stepIndex('ArrowRight', 2, 5)).toBe(3)
    expect(stepIndex('ArrowLeft', 2, 5)).toBe(1)
    expect(stepIndex('ArrowRight', 4, 5)).toBe(4)
    expect(stepIndex('ArrowLeft', 0, 5)).toBe(0)
  })

  test('Home and End go to the first and the last stop', () => {
    expect(stepIndex('Home', 2, 5)).toBe(0)
    expect(stepIndex('End', 2, 5)).toBe(4)
  })

  test('other keys are left to the page', () => {
    expect(stepIndex('Tab', 2, 5)).toBeNull()
    expect(stepIndex('a', 2, 5)).toBeNull()
  })
})
