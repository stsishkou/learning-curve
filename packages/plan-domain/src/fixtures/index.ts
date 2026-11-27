// Fixture data for stories and tests: a frozen copy of the real schedule with fixed dates.
// Nothing here reads the database on disk or the courses, so it stays the same whatever was edited.
import { applyChange, type PlanChange } from '../core/changes'
import { DAY, mondayOf, parseLocal } from '../core/dates'
import { applyEdits, emptyEdits, type PlanEdits } from '../core/edits'
import { isSession } from '../core/progress'
import { trashOf } from '../core/trash'
import { isPlan, type Plan } from '../core/types'
import basePlan from './base-plan.json'

/** The item a story or a test counts on. A list that is too short fails here, by name, not later as `undefined`. */
export function itemAt<T>(items: ArrayLike<T>, index = 0): T {
  const item = items[index]
  if (item === undefined) throw new Error(`No item ${index} in a list of ${items.length}`)
  return item
}

function load(): Plan {
  if (!isPlan(basePlan)) throw new Error('packages/plan-domain/src/fixtures/base-plan.json is not a plan')
  return basePlan
}

/** The plan the owner's courses generated on 2026-11-22, frozen as JSON: editing a course does not change a test. */
export const fixtureBase: Plan = load()

const generated = fixtureBase

/** A Wednesday inside the certificate block, 12:40: one session is running, the week has past and future ones. */
export const fixtureNow = parseLocal('2026-12-02T12:40')
export const fixtureWeek = mondayOf(fixtureNow)

const finished = generated.events.filter((e) => isSession(e) && parseLocal(e.end) <= fixtureNow)
const doneEdits: PlanEdits = {
  ...emptyEdits(),
  events: Object.fromEntries(finished.map((e) => [e.uid, { done: true }])),
}

/** The generated plan with every session before `fixtureNow` marked done. */
export const fixturePlan = applyEdits(generated, doneEdits).plan

/** uids that differ from the generated schedule */
export const fixtureEdited = finished.map((e) => e.uid)

const REMOVED_AT = Date.parse('2026-11-30T09:00:00Z')
const upcoming = generated.events.filter((e) => isSession(e) && parseLocal(e.start) > fixtureNow)
const trashChanges: PlanChange[] = [
  ...upcoming.slice(0, 2).map((e): PlanChange => ({ type: 'event.remove', uid: e.uid })),
  { type: 'calendar.remove', id: 'journey' },
]
const trashEdits = trashChanges.reduce((edits, change) => applyChange(generated, edits, change, REMOVED_AT), doneEdits)

/** Two removed events and one removed calendar, 27 days before they are gone for good. */
export const fixtureTrash = trashOf(generated, trashEdits, REMOVED_AT + 3 * DAY)
