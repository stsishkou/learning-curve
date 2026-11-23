import { describe, expect, test } from 'vitest'

import { applyChange, parseChange, type NewEvent, type PlanChange } from './changes'
import { applyEdits, emptyEdits, type PlanEdits } from './edits'
import { itemAt } from './fixtures'
import { DEFAULT_CONFIG, buildPlan } from './schedule'
import { UPDATE_CHANGE_TYPES } from './schema'
import { TRASH_DAYS, trashOf } from './trash'
import type { Plan, PlanEvent } from './types'
import { parseUpdate, previewUpdate } from './update'

const base = buildPlan(DEFAULT_CONFIG, '2026-11-22')
const NOW = Date.parse('2026-11-23T09:00:00Z')

const apply = (changes: PlanChange[], edits: PlanEdits = emptyEdits(), now = NOW) =>
  changes.reduce((sofar, change) => applyChange(base, sofar, change, now), edits)
const planOf = (edits: PlanEdits): Plan => applyEdits(base, edits).plan
const find = (plan: Plan, uid: string): PlanEvent | undefined => plan.events.find((e) => e.uid === uid)
const added = (edits: PlanEdits) => itemAt(edits.added, edits.added.length - 1)

const SESSION = 'certs-001@learning-curve'
const NEXT = 'certs-002@learning-curve'
const GYM = 'personal-001@learning-curve'
const session = (overrides: Partial<NewEvent> = {}): NewEvent => ({
  calendar: 'journey',
  title: 'Extra',
  start: '2026-12-03T20:00',
  end: '2026-12-03T21:00',
  description: '',
  availability: 'busy' as const,
  ...overrides,
})
/** A session of a new course: its calendar is the course */
const { calendar: _calendar, ...courseSession } = session()

/**
 * One example of every kind of change. The type makes a new kind fail to compile here until it has an example, so
 * the round trips below cover it.
 */
const EXAMPLES: { [K in PlanChange['type']]: Extract<PlanChange, { type: K }> } = {
  'event.patch': { type: 'event.patch', uid: SESSION, patch: { start: '2026-11-23T19:00', end: '2026-11-23T20:00' } },
  'event.add': { type: 'event.add', event: session() },
  'event.remove': { type: 'event.remove', uid: SESSION },
  'event.detach': {
    type: 'event.detach',
    uid: GYM,
    day: '2026-11-26',
    start: '2026-11-26T18:00',
    end: '2026-11-26T20:00',
  },
  'calendar.save': { type: 'calendar.save', id: 'journey', name: 'Journey', color: '#123456' },
  'calendar.remove': { type: 'calendar.remove', id: 'journey' },
  'calendar.clear': { type: 'calendar.clear', id: 'journey' },
  'trash.restore': { type: 'trash.restore' },
  'trash.empty': { type: 'trash.empty' },
  'events.shift': { type: 'events.shift', calendar: 'certs', from: '2026-11-23', days: 1 },
  'events.move': { type: 'events.move', moves: [{ uid: SESSION, start: '2026-11-23T19:00', end: '2026-11-23T20:00' }] },
  'events.done': { type: 'events.done', uids: [SESSION], done: true },
  'plan.rename': { type: 'plan.rename', title: 'Another plan' },
  'reviews.plan': { type: 'reviews.plan', reviews: [session({ title: 'Review' })] },
  'course.add': { type: 'course.add', name: 'New course', color: '#0A7F5A', sessions: [courseSession] },
  'events.add': { type: 'events.add', events: [session(), session({ title: 'Extra 2' })] },
}

describe('every kind of change', () => {
  test.each(Object.values(EXAMPLES))('$type survives a trip through JSON, as the history stores it', (change) => {
    const stored = JSON.stringify(change)
    expect(parseChange(JSON.parse(stored))).toEqual(change)
  })

  test.each(Object.values(EXAMPLES))('$type applies to the generated plan', (change) => {
    expect(() => apply([change])).not.toThrow()
  })

  test.each(UPDATE_CHANGE_TYPES)('%s goes from an update through the preview without a problem', (type) => {
    const update = parseUpdate(JSON.stringify({ summary: type, changes: [EXAMPLES[type]] }))
    expect(previewUpdate(base, update.changes, NOW).problem).toBeNull()
  })
})

describe('event.patch', () => {
  test('moves an event and keeps only what differs from the original', () => {
    const edits = apply([EXAMPLES['event.patch']])
    expect(find(planOf(edits), SESSION)).toMatchObject({ start: '2026-11-23T19:00', end: '2026-11-23T20:00' })
    const original = itemAt(base.events)
    const back = apply(
      [{ type: 'event.patch', uid: SESSION, patch: { start: original.start, end: original.end } }],
      edits,
    )
    expect(back.events).toEqual({})
  })

  test('null drops the manual changes of a generated event', () => {
    const edits = apply([EXAMPLES['event.patch'], { type: 'event.patch', uid: SESSION, patch: null }])
    expect(edits.events).toEqual({})
  })

  test('refuses an end before the start and an unknown event', () => {
    expect(() => apply([{ type: 'event.patch', uid: SESSION, patch: { end: '2026-11-23T11:00' } }])).toThrow(
      /end after/,
    )
    expect(() => apply([{ type: 'event.patch', uid: 'nope', patch: { title: 'x' } }])).toThrow(/Unknown event/)
  })

  test('the real time of a session goes when it is no longer done', () => {
    const done = apply([{ type: 'event.patch', uid: SESSION, patch: { done: true, actual: 75 } }])
    expect(find(planOf(done), SESSION)).toMatchObject({ done: true, actual: 75 })
    const undone = apply([{ type: 'event.patch', uid: SESSION, patch: { done: false } }], done)
    expect(find(planOf(undone), SESSION)?.actual).toBeUndefined()
  })
})

describe('adding events', () => {
  test('event.add creates an event with its own uid: busy is study, free is personal', () => {
    const busy = added(apply([EXAMPLES['event.add']]))
    expect(busy).toMatchObject({ title: 'Extra', kind: 'study' })
    expect(busy.uid).toMatch(/^custom-.+@learning-curve$/)
    expect(added(apply([{ type: 'event.add', event: session({ availability: 'free' }) }])).kind).toBe('personal')
  })

  test('event.add refuses a calendar that does not exist', () => {
    expect(() => apply([{ type: 'event.add', event: session({ calendar: 'nope' }) }])).toThrow(/Unknown calendar/)
  })

  test('events.add adds several, reviews.plan adds reviews', () => {
    expect(apply([EXAMPLES['events.add']]).added).toHaveLength(2)
    expect(added(apply([EXAMPLES['reviews.plan']])).kind).toBe('review')
  })

  test('course.add creates the calendar with its sessions and refuses a name that is taken', () => {
    const edits = apply([EXAMPLES['course.add']])
    const calendar = planOf(edits).calendars.find((c) => c.name === 'New course')
    expect(calendar).toBeDefined()
    expect(added(edits).calendar).toBe(calendar?.id)
    expect(() => apply([EXAMPLES['course.add']], edits)).toThrow(/already exists/)
  })
})

describe('repeats', () => {
  test('event.detach moves one repeat and leaves the series', () => {
    const edits = apply([EXAMPLES['event.detach']])
    const plan = planOf(edits)
    expect(find(plan, GYM)).toMatchObject({ skip: ['2026-11-26'], rrule: 'FREQ=WEEKLY;BYDAY=TU,TH' })
    const single = added(edits)
    expect(single).toMatchObject({ title: 'Спортзал', start: '2026-11-26T18:00', end: '2026-11-26T20:00' })
    expect(single.rrule).toBeUndefined()
  })

  test('event.detach refuses an event that does not repeat', () => {
    expect(() => apply([{ ...EXAMPLES['event.detach'], uid: SESSION }])).toThrow(/repeating/)
  })
})

describe('trash', () => {
  test('a removed event leaves the plan and comes back on restore', () => {
    const removed = apply([EXAMPLES['event.remove']])
    expect(find(planOf(removed), SESSION)).toBeUndefined()
    expect(trashOf(base, removed, NOW).events.map((t) => t.event.uid)).toEqual([SESSION])
    expect(find(planOf(apply([{ type: 'trash.restore', events: [SESSION] }], removed)), SESSION)).toBeDefined()
  })

  test('calendar.clear empties the calendar and keeps it; calendar.remove takes both', () => {
    const cleared = planOf(apply([EXAMPLES['calendar.clear']]))
    expect(cleared.calendars.some((c) => c.id === 'journey')).toBe(true)
    expect(cleared.events.some((e) => e.calendar === 'journey')).toBe(false)
    const removed = planOf(apply([EXAMPLES['calendar.remove']]))
    expect(removed.calendars.some((c) => c.id === 'journey')).toBe(false)
    expect(removed.events.some((e) => e.calendar === 'journey')).toBe(false)
  })

  test('trash.empty removes for good: a restore no longer brings it back', () => {
    const emptied = apply([EXAMPLES['event.remove'], EXAMPLES['trash.empty'], EXAMPLES['trash.restore']])
    expect(find(planOf(emptied), SESSION)).toBeUndefined()
    expect(trashOf(base, emptied, NOW).events).toEqual([])
  })

  test(`the trash keeps a removed event for ${TRASH_DAYS} days`, () => {
    const removed = apply([EXAMPLES['event.remove']])
    expect(trashOf(base, removed, NOW + (TRASH_DAYS - 1) * 86_400_000).events).toHaveLength(1)
    expect(trashOf(base, removed, NOW + (TRASH_DAYS + 1) * 86_400_000).events).toHaveLength(0)
  })
})

describe('several sessions', () => {
  test('events.shift moves the open sessions of one calendar and leaves the done ones', () => {
    const done = apply([{ type: 'events.done', uids: [SESSION], done: true }])
    const plan = planOf(apply([EXAMPLES['events.shift']], done))
    expect(find(plan, SESSION)?.start).toBe(itemAt(base.events).start)
    expect(find(plan, NEXT)?.start).toBe('2026-11-24T13:00')
    expect(find(plan, GYM)?.start).toBe(find(base, GYM)?.start)
  })

  test('events.shift refuses when nothing would move', () => {
    expect(() => apply([{ ...EXAMPLES['events.shift'], from: '2030-01-01' }])).toThrow(/No sessions/)
  })

  test('events.move moves all as one step and marks them paced when asked', () => {
    const plan = planOf(apply([{ ...EXAMPLES['events.move'], paced: true }]))
    expect(find(plan, SESSION)).toMatchObject({ start: '2026-11-23T19:00', paced: true })
  })

  test('events.done marks the sessions it knows and skips the rest', () => {
    const plan = planOf(apply([{ type: 'events.done', uids: [SESSION, NEXT, 'nope'], done: true }]))
    expect([find(plan, SESSION)?.done, find(plan, NEXT)?.done]).toEqual([true, true])
  })
})

describe('names', () => {
  test('plan.rename sets the title, and the generated name again clears the edit', () => {
    const renamed = apply([EXAMPLES['plan.rename']])
    expect(planOf(renamed).meta.title).toBe('Another plan')
    expect(apply([{ type: 'plan.rename', title: base.meta.title }], renamed).title).toBeUndefined()
  })

  test('calendar.save renames a calendar, or creates one without an id', () => {
    expect(planOf(apply([EXAMPLES['calendar.save']])).calendars.find((c) => c.id === 'journey')?.name).toBe('Journey')
    const created = planOf(apply([{ type: 'calendar.save', name: 'Reading', color: '#445566' }]))
    expect(created.calendars.some((c) => c.name === 'Reading' && c.custom)).toBe(true)
  })
})
