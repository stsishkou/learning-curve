import { expect, test } from 'vitest'

import { applyChange, type PlanChange } from './changes'
import { applyEdits, emptyEdits } from './edits'
import { HISTORY_LIMIT, emptyHistory, historyEdits, inSync, parseHistory, recordChange, travel } from './history'
import { DEFAULT_CONFIG, buildPlan } from './schedule'

const base = buildPlan(DEFAULT_CONFIG, '2026-11-22')
const rename = (title: string): PlanChange => ({ type: 'plan.rename', title })

/** The history after the changes, each stored as the server stores it. */
function record(changes: PlanChange[], history = emptyHistory()) {
  return changes.reduce((sofar, change) => {
    const edits = historyEdits(sofar)
    return recordChange(sofar, applyEdits(base, edits).plan, change, applyChange(base, edits, change))
  }, history)
}

const titleAt = (history: ReturnType<typeof emptyHistory>, cursor?: number) => historyEdits(history, cursor).title

test('each change is a step, and travelling moves the edits back and forward', () => {
  const history = record([rename('One'), rename('Two')])
  expect(history.cursor).toBe(2)
  expect(titleAt(history)).toBe('Two')
  expect(titleAt(travel(history, 1))).toBe('One')
  expect(historyEdits(travel(history, 0))).toEqual(emptyEdits())
  expect(travel(history, 9).cursor).toBe(2)
})

test('a change after an undo drops the undone steps: they cannot be redone', () => {
  const undone = travel(record([rename('One'), rename('Two'), rename('Three')]), 1)
  const branched = record([rename('Other')], undone)
  expect(branched.steps.map((step) => step.subject)).toEqual(['One', 'Other'])
  expect(branched.cursor).toBe(2)
})

test(`after ${HISTORY_LIMIT} steps the oldest becomes the starting point`, () => {
  const many = Array.from({ length: HISTORY_LIMIT + 1 }, (_, i) => rename(`Title ${i}`))
  const history = record(many)
  expect(history.steps).toHaveLength(HISTORY_LIMIT)
  expect(history.origin.title).toBe('Title 0')
  expect(titleAt(history)).toBe(`Title ${HISTORY_LIMIT}`)
})

test('the history no longer describes edits changed past it', () => {
  const history = record([rename('One')])
  expect(inSync(history, historyEdits(history))).toBe(true)
  expect(inSync(history, { ...historyEdits(history), title: 'By hand' })).toBe(false)
})

test('a history survives JSON, and a broken one reads as empty', () => {
  const recorded = record([rename('One')])
  const fromGoogle = recordChange(
    recorded,
    base,
    rename('Two'),
    applyChange(base, historyEdits(recorded), rename('Two')),
    'google',
  )
  expect(fromGoogle.steps.map((step) => step.source)).toEqual([undefined, 'google'])
  const history = travel(fromGoogle, 1)
  const stored = JSON.stringify(history)
  expect(parseHistory(JSON.parse(stored))).toEqual(history)
  expect(parseHistory({ steps: [{ at: 'now', change: { type: 'nope' } }] })).toEqual(emptyHistory())
  expect(parseHistory(null)).toEqual(emptyHistory())
})
