import type { PlanChange } from '../changes'
import type { RebalanceResult } from './types'

/**
 * The change that stores a re-balance, or null when there is nothing to store: when nothing moves, or while a session
 * finds no room, as the others would move around it and leave it where it was, on top of whatever took its place.
 */
export const rebalanceChange = (result: RebalanceResult, calendar: string): PlanChange | null =>
  result.moves.length && result.report.unplaced === 0
    ? { type: 'events.move', moves: result.moves, reason: 'rebalance', calendar }
    : null
