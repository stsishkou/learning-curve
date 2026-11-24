import { describe, expect, it } from 'vitest'

import {
  blockOf,
  GLASS_DEFAULTS,
  parseSettings,
  parseSitting,
  rhythmOf,
  type GlassSettings,
  type Sitting,
} from './blocks'

const MINUTE = 60_000
const NOW = Date.UTC(2026, 10, 24, 9)
const session = (planned = 90 * MINUTE) => ({ uid: 'a', planned, now: NOW })
const short: GlassSettings = { ...GLASS_DEFAULTS, mode: 'short' }

describe('parseSettings', () => {
  it('opens on the session glass', () => {
    expect(parseSettings(null)).toEqual(GLASS_DEFAULTS)
    expect(GLASS_DEFAULTS.mode).toBe('session')
  })

  it('reads the rhythm stored before the glass', () => {
    expect(parseSettings('off').mode).toBe('session')
    expect(parseSettings('short').mode).toBe('short')
    expect(parseSettings('long').mode).toBe('long')
  })

  it('keeps the custom minutes within their ranges and drops what it cannot read', () => {
    expect(parseSettings(JSON.stringify({ mode: 'custom', work: 500, rest: 0, still: true, hidden: 'yes' }))).toEqual({
      mode: 'custom',
      work: 180,
      rest: 1,
      still: true,
      hidden: false,
    })
    expect(parseSettings('{"mode":"never"')).toEqual(GLASS_DEFAULTS)
    expect(parseSettings(JSON.stringify({ mode: 'sometimes', work: 12.6 }))).toEqual({ ...GLASS_DEFAULTS, work: 13 })
  })

  it('gives each mode its rhythm', () => {
    expect(rhythmOf(GLASS_DEFAULTS)).toBeNull()
    expect(rhythmOf(short)).toEqual({ every: 25 * MINUTE, rest: 5 * MINUTE })
    expect(rhythmOf({ ...GLASS_DEFAULTS, mode: 'custom', work: 40, rest: 8 })).toEqual({
      every: 40 * MINUTE,
      rest: 8 * MINUTE,
    })
  })
})

describe('parseSitting', () => {
  it('reads a stored sitting and nothing else', () => {
    const sitting: Sitting = { uid: 'a', from: 25 * MINUTE, restUntil: NOW, rest: 5 * MINUTE }
    expect(parseSitting(JSON.stringify(sitting))).toEqual(sitting)
    expect(parseSitting(JSON.stringify({ uid: 'a', from: 'x' }))).toBeNull()
    expect(parseSitting('nope')).toBeNull()
  })
})

describe('blockOf', () => {
  it('pours the whole planned session through one glass', () => {
    const block = blockOf({ ...session(), settings: GLASS_DEFAULTS, sitting: null, elapsed: 30 * MINUTE })
    expect(block).toEqual({ kind: 'work', length: 90 * MINUTE, run: 30 * MINUTE, key: 'a:session' })
    expect(blockOf({ ...session(), settings: GLASS_DEFAULTS, sitting: null, elapsed: 2 * 90 * MINUTE }).run).toBe(
      90 * MINUTE,
    )
  })

  it('counts a work block from where the sitting turned the glass', () => {
    const sitting: Sitting = { uid: 'a', from: 27 * MINUTE, restUntil: null, rest: 0 }
    expect(blockOf({ ...session(), settings: short, sitting, elapsed: 30 * MINUTE })).toEqual({
      kind: 'work',
      length: 25 * MINUTE,
      run: 3 * MINUTE,
      key: `a:work:${27 * MINUTE}`,
    })
  })

  it('starts from the beginning for another session, or after the stopwatch was reset', () => {
    const other: Sitting = { uid: 'b', from: 27 * MINUTE, restUntil: null, rest: 0 }
    expect(blockOf({ ...session(), settings: short, sitting: other, elapsed: 30 * MINUTE }).run).toBe(25 * MINUTE)
    const ahead: Sitting = { uid: 'a', from: 27 * MINUTE, restUntil: null, rest: 0 }
    expect(blockOf({ ...session(), settings: short, sitting: ahead, elapsed: 4 * MINUTE })).toMatchObject({
      run: 4 * MINUTE,
      key: 'a:work:0',
    })
  })

  it('counts a break down by the wall clock, whatever the stopwatch says', () => {
    const sitting: Sitting = { uid: 'a', from: 25 * MINUTE, restUntil: NOW + 3 * MINUTE, rest: 5 * MINUTE }
    expect(blockOf({ ...session(), settings: short, sitting, elapsed: 25 * MINUTE })).toEqual({
      kind: 'rest',
      length: 5 * MINUTE,
      run: 2 * MINUTE,
      key: `a:rest:${NOW + 3 * MINUTE}`,
    })
    const over = { ...sitting, restUntil: NOW - MINUTE }
    expect(blockOf({ ...session(), settings: short, sitting: over, elapsed: 25 * MINUTE }).run).toBe(5 * MINUTE)
  })
})
