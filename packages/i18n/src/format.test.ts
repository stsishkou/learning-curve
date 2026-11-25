import { beforeEach, describe, expect, test } from 'vitest'

import { fmtDirection, fmtFactor, fmtRatio } from './format'
import { overwriteGetLocale } from './paraglide/runtime.js'

describe('fmtRatio', () => {
  beforeEach(() => overwriteGetLocale(() => 'en'))

  test('reads a ratio as the factor and how much longer or shorter that is', () => {
    expect(fmtRatio(1.25)).toBe('×1.25 · 25% longer')
    expect(fmtRatio(0.8)).toBe('×0.8 · 20% shorter')
  })

  test('says "as planned" once the difference rounds to none', () => {
    expect(fmtRatio(1.004)).toBe('×1 · as planned')
  })

  test('gives the factor two decimals at most', () => {
    expect(fmtRatio(1.3333)).toBe('×1.33 · 33% longer')
    expect(fmtFactor(1.3333)).toBe('×1.33')
  })

  test('writes the numbers the way the language does', () => {
    overwriteGetLocale(() => 'ru')
    expect(fmtRatio(1.25)).toBe('×1,25 · на 25\u00a0% дольше')
  })
})

describe('fmtDirection', () => {
  test('points up for a time longer than its plan and down for a shorter one', () => {
    expect(fmtDirection(1.25)).toBe('▲')
    expect(fmtDirection(0.8)).toBe('▼')
  })

  test('shows nothing where the ratio reads as planned', () => {
    expect(fmtDirection(1.004)).toBe('')
    expect(fmtDirection(1)).toBe('')
  })
})
