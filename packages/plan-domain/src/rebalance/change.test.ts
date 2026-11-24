import { describe, expect, test } from 'vitest'

import { rebalanceChange } from './change'
import type { RebalanceReport, RebalanceResult } from './types'

const report = (overrides: Partial<RebalanceReport> = {}): RebalanceReport => ({
  finish: '2027-01-14',
  finishBefore: '2027-01-20',
  deadline: null,
  peakWeek: 5,
  peakDay: 2,
  overWeeks: [],
  moved: 1,
  late: 0,
  unplaced: 0,
  provenBest: true,
  reasons: [],
  ...overrides,
})

const move = { uid: 's3', start: '2027-01-08T11:00', end: '2027-01-08T12:00' }

describe('rebalanceChange', () => {
  test('moves every session that changes its slot as one step, marked as the re-balance of the calendar', () => {
    const result: RebalanceResult = { moves: [move], report: report() }
    expect(rebalanceChange(result, 'c')).toEqual({
      type: 'events.move',
      moves: [move],
      reason: 'rebalance',
      calendar: 'c',
    })
  })

  test('is nothing when nothing moves', () => {
    expect(rebalanceChange({ moves: [], report: report({ moved: 0 }) }, 'c')).toBeNull()
  })

  test('is nothing while a session finds no room: the rest would move around it and leave it where it was', () => {
    expect(rebalanceChange({ moves: [move], report: report({ unplaced: 1 }) }, 'c')).toBeNull()
  })
})
