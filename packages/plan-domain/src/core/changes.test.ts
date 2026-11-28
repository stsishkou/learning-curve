import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, test } from 'vitest'

import { fixtureBase, itemAt } from '../fixtures'
import { reviewOffers } from '../insights/reviews'
import { planStats } from '../insights/stats'
import { UPDATE_CHANGE_TYPES, UPDATE_SCHEMA } from '../protocol/schema'
import { parseUpdate, previewUpdate } from '../protocol/update'
import { applyChange, parseChange, splitInHalves, type NewEvent, type PlanChange } from './changes'
import { DAY, parseLocal, toLocalString, toMinsk } from './dates'
import { deadlineOf } from './deadlines'
import { applyEdits, emptyEdits, parseEdits, shownPlan, type PlanEdits } from './edits'
import { weekOutcomes, weekReview } from './goals'
import { emptyHistory, recordChange } from './history'
import { countsTwice, groupByLabel, planLabels } from './labels'
import { courseProgress, doneWithoutTime, isSession } from './progress'
import { TRASH_DAYS, purgeTrash, trashOf } from './trash'
import type { Plan, PlanEvent } from './types'

const base = fixtureBase
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

/** Reads an `event.add` of a milestone on 16 February with the fields given replaced */
const milestone = (overrides: Record<string, unknown>) => () =>
  parseChange({
    type: 'event.add',
    event: { ...session({ start: '2027-02-16T00:00', end: '2027-02-16T00:00' }), kind: 'milestone', ...overrides },
  })

const length = (event: PlanEvent | undefined) => (event ? parseLocal(event.end) - parseLocal(event.start) : 0)
const shift = (by: { days?: number; hours?: number }): Extract<PlanChange, { type: 'events.shift' }> => ({
  type: 'events.shift',
  calendars: ['certs'],
  from: '2026-11-23',
  ...by,
})
const firstSessionOf = (calendar: string) =>
  base.events.find((e) => e.calendar === calendar && isSession(e) && e.start >= '2026-11-23')
const parseShift = (by: object) => () => parseChange({ type: 'events.shift', from: '2026-11-23', ...by })

/**
 * One example of every kind of change. The type makes a new kind fail to compile here until it has an example, so
 * the round trips below cover it.
 */
const EXAMPLES: { [K in PlanChange['type']]: Extract<PlanChange, { type: K }> } = {
  'event.patch': { type: 'event.patch', uid: SESSION, patch: { start: '2026-11-23T19:00', end: '2026-11-23T20:00' } },
  'event.add': { type: 'event.add', event: session() },
  'event.remove': { type: 'event.remove', uid: SESSION },
  'event.split': {
    type: 'event.split',
    uid: SESSION,
    parts: [
      { start: '2026-11-23T12:00', end: '2026-11-23T12:30' },
      { start: '2026-11-26T18:00', end: '2026-11-26T18:30' },
    ],
  },
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
  'calendars.order': { type: 'calendars.order', ids: ['personal', 'certs'] },
  'calendar.hide': { type: 'calendar.hide', id: 'journey', hidden: true },
  'calendar.labels': { type: 'calendar.labels', id: 'journey', labels: ['Partners', 'Certification'] },
  'label.rename': { type: 'label.rename', from: 'Partners', to: 'Google Partners' },
  'label.hide': { type: 'label.hide', label: 'Partners', hidden: true },
  'week.review': { type: 'week.review', week: '2026-11-23', note: 'Two modules done, one missed' },
  'trash.restore': { type: 'trash.restore' },
  'trash.empty': { type: 'trash.empty' },
  'events.shift': { type: 'events.shift', calendars: ['certs', 'hfllm'], from: '2026-11-23', days: 1, hours: 0.5 },
  'events.move': {
    type: 'events.move',
    moves: [{ uid: SESSION, start: '2026-11-23T19:00', end: '2026-11-23T20:00' }],
    reason: 'rebalance',
    calendar: 'certs',
  },
  'events.done': { type: 'events.done', uids: [SESSION, NEXT], done: true, actual: { [SESSION]: 70 } },
  'session.finish': { type: 'session.finish', uid: SESSION, actual: 68, began: '2026-11-23T12:04', paused: 7 },
  'session.continue': { type: 'session.continue', uid: SESSION, start: '2026-11-26T18:00', end: '2026-11-26T18:35' },
  'plan.rename': { type: 'plan.rename', title: 'Another plan' },
  'plan.countdown': { type: 'plan.countdown', calendar: 'hfllm' },
  'plan.budget': { type: 'plan.budget', hours: 10 },
  'plan.dayLimit': { type: 'plan.dayLimit', hours: 3 },
  'reviews.plan': { type: 'reviews.plan', reviews: [session({ title: 'Review' })] },
  'course.add': { type: 'course.add', name: 'New course', color: '#0A7F5A', sessions: [courseSession] },
  'events.add': { type: 'events.add', events: [session(), session({ title: 'Extra 2' })] },
}

describe('every kind of change', () => {
  test.each(Object.values(EXAMPLES))('$type survives a trip through JSON, as the history stores it', (change) => {
    const stored = JSON.stringify(change)
    expect(parseChange(JSON.parse(stored))).toEqual(change)
  })

  /** A label is renamed only where some calendar carries it */
  const before: Partial<Record<PlanChange['type'], PlanChange[]>> = {
    'label.rename': [EXAMPLES['calendar.labels']],
    'label.hide': [EXAMPLES['calendar.labels']],
  }
  test.each(Object.values(EXAMPLES))('$type applies to the generated plan', (change) => {
    expect(() => apply([...(before[change.type] ?? []), change])).not.toThrow()
  })

  const validUpdate = new Ajv2020({ strict: false }).compile(UPDATE_SCHEMA)
  test.each(UPDATE_CHANGE_TYPES)('%s with all its fields fits the update schema', (type) => {
    expect(validUpdate({ changes: [EXAMPLES[type]] }), JSON.stringify(validUpdate.errors)).toBe(true)
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

describe('events.done', () => {
  test('logs the minutes given for each session it marks done; the others stay without a time', () => {
    const plan = planOf(apply([EXAMPLES['events.done']]))
    expect(find(plan, SESSION)).toMatchObject({ done: true, actual: 70 })
    expect(find(plan, NEXT)).toMatchObject({ done: true })
    expect(find(plan, NEXT)).not.toHaveProperty('actual')
  })

  test('refuses times out of range, for a session it does not name, or when it marks sessions not done', () => {
    const bad = [
      { actual: { [SESSION]: 4 } },
      { actual: { [SESSION]: 61.5 } },
      { actual: { [GYM]: 60 } },
      { actual: [60] },
      { done: false, actual: { [SESSION]: 60 } },
    ]
    for (const fields of bad) {
      expect(() => parseChange({ ...EXAMPLES['events.done'], ...fields }), JSON.stringify(fields)).toThrow()
    }
  })
})

describe('a session that is not finished', () => {
  const done = { type: 'event.patch', uid: SESSION, patch: { done: true, actual: 60 } } as const
  const mark = (unfinished: boolean): PlanChange => ({ type: 'event.patch', uid: SESSION, patch: { unfinished } })

  test('a done session can say its goal was not met, and take that back', () => {
    const marked = apply([done, mark(true)])
    expect(find(planOf(marked), SESSION)).toMatchObject({ done: true, actual: 60, unfinished: true })
    expect(find(planOf(apply([mark(false)], marked)), SESSION)).not.toHaveProperty('unfinished')
  })

  test('the mark goes when the session is no longer done, and a session not done cannot carry it', () => {
    const marked = apply([done, mark(true)])
    expect(
      find(planOf(apply([{ type: 'events.done', uids: [SESSION], done: false }], marked)), SESSION),
    ).not.toHaveProperty('unfinished')
    expect(find(planOf(apply([mark(true)])), SESSION)).not.toHaveProperty('unfinished')
  })

  test('is read back from the edits file, for generated and added sessions', () => {
    const extra = apply([EXAMPLES['event.add']])
    const { uid } = added(extra)
    const edits = apply(
      [done, mark(true), { type: 'event.patch', uid, patch: { done: true, unfinished: true } }],
      extra,
    )
    expect(added(edits)).toMatchObject({ done: true, unfinished: true })
    expect(parseEdits(structuredClone(edits))).toEqual(edits)
  })

  test('refuses a mark that is not true or false', () => {
    expect(() => parseChange({ type: 'event.patch', uid: SESSION, patch: { unfinished: 'yes' } })).toThrow()
  })

  test('an update may say so, as the person tells it, and the preview shows no warning for it', () => {
    const update = parseUpdate({ changes: [{ ...done, patch: { ...done.patch, unfinished: true } }] })
    const preview = previewUpdate(base, update.changes, NOW)
    expect(preview.problem).toBeNull()
    const marked = apply([done])
    expect(previewUpdate(planOf(marked), [mark(true)], NOW).warnings).toEqual([])
  })
})

const resize = (uid: string, end: string): PlanChange => ({ type: 'event.patch', uid, patch: { end } })

describe('the first planned length', () => {
  const original = itemAt(base.events.filter((e) => e.uid === SESSION))
  const later = (minutes: number, of: PlanEvent = original) => toLocalString(parseLocal(of.start) + minutes * 60_000)

  test('a resized generated session keeps the length it was planned with; a moved one has none to keep', () => {
    expect(find(planOf(apply([resize(SESSION, later(90))])), SESSION)?.estimate).toBe(60)
    expect(find(planOf(apply([EXAMPLES['event.patch']])), SESSION)).not.toHaveProperty('estimate')
  })

  test('an added session keeps its first length, however often it is resized after', () => {
    const extra = apply([EXAMPLES['event.add']])
    const event = added(extra)
    const resized = apply([resize(event.uid, later(90, event)), resize(event.uid, later(120, event))], extra)
    expect(added(resized)).toMatchObject({ estimate: 60, end: later(120, event) })
    expect(parseEdits(structuredClone(resized))).toEqual(resized)
  })

  test('a split keeps the whole length on its first part, and the other parts name the session they came from', () => {
    const edits = apply([EXAMPLES['event.split']])
    expect(find(planOf(edits), SESSION)?.estimate).toBe(60)
    expect(added(edits)).toMatchObject({ from: SESSION })
    expect(added(edits)).not.toHaveProperty('estimate')
    expect(parseEdits(structuredClone(edits))).toEqual(edits)
  })

  test('an event.patch cannot set them: the app keeps them', () => {
    for (const patch of [{ estimate: 30 }, { from: NEXT }]) {
      expect(() => parseChange({ type: 'event.patch', uid: SESSION, patch }), JSON.stringify(patch)).toThrow(/app/)
    }
  })
})

describe('session.finish', () => {
  const finish = EXAMPLES['session.finish']
  const STOPWATCH = ['measured', 'began', 'paused']
  const record = { done: true, actual: 68, measured: true, began: '2026-11-23T12:04', paused: 7 }
  const keepsNoRecord = (event: PlanEvent | undefined) => {
    for (const key of STOPWATCH) expect(event).not.toHaveProperty(key)
  }

  test('marks the session done with the stopwatch time, its first start and its pauses', () => {
    expect(find(planOf(apply([finish])), SESSION)).toMatchObject(record)
  })

  test('a stopwatch that never stood keeps no pause', () => {
    expect(find(planOf(apply([{ ...finish, paused: 0 }])), SESSION)).not.toHaveProperty('paused')
  })

  test('a time typed by hand replaces the stopwatch record', () => {
    const typed = apply([{ type: 'event.patch', uid: SESSION, patch: { actual: 75 } }], apply([finish]))
    const event = find(planOf(typed), SESSION)
    expect(event).toMatchObject({ done: true, actual: 75 })
    keepsNoRecord(event)
  })

  test('the record goes when the session is no longer done', () => {
    const undone = apply([{ type: 'event.patch', uid: SESSION, patch: { done: false } }], apply([finish]))
    keepsNoRecord(find(planOf(undone), SESSION))
  })

  test('works on an added session and goes with its done mark too', () => {
    const extra = apply([EXAMPLES['event.add']])
    const { uid } = added(extra)
    const finished = apply([{ ...finish, uid }], extra)
    expect(added(finished)).toMatchObject(record)
    keepsNoRecord(added(apply([{ type: 'event.patch', uid, patch: { done: false } }], finished)))
  })

  test('is read back from the edits file, for generated and added sessions', () => {
    const extra = apply([EXAMPLES['event.add']])
    const edits = apply([finish, { ...finish, uid: added(extra).uid }], extra)
    expect(parseEdits(structuredClone(edits))).toEqual(edits)
  })

  test('refuses a time out of range, a start that is not a time and a pause below zero', () => {
    for (const bad of [{ actual: 4 }, { actual: 1441 }, { began: '2026-11-23 12:04' }, { paused: -1 }]) {
      expect(() => parseChange({ ...finish, ...bad }), JSON.stringify(bad)).toThrow()
    }
  })

  test('an event.patch cannot claim stopwatch time', () => {
    const claims = { measured: true, began: '2026-11-23T12:04', paused: 5 }
    for (const [key, value] of Object.entries(claims)) {
      const patch = { done: true, actual: 60, [key]: value }
      expect(() => parseChange({ type: 'event.patch', uid: SESSION, patch }), key).toThrow(/stopwatch/)
    }
  })

  test('an update from a chat or a tool cannot carry it', () => {
    expect(() => parseUpdate({ changes: [finish] })).toThrow()
  })
})

describe('adding events', () => {
  test('event.add creates an event with its own uid: busy is study, free is personal', () => {
    const busy = added(apply([EXAMPLES['event.add']]))
    expect(busy).toMatchObject({ title: 'Extra', kind: 'study' })
    expect(busy.uid).toMatch(/^custom-.+@learning-curve$/)
    expect(added(apply([{ type: 'event.add', event: session({ availability: 'free' }) }])).kind).toBe('personal')
  })

  test("event.add of a milestone sets the calendar's deadline: all day and free", () => {
    const deadline = parseChange({
      type: 'event.add',
      event: session({
        title: 'Дедлайн: Journey',
        start: '2027-02-16T00:00',
        end: '2027-02-16T00:00',
        kind: 'milestone',
      }),
    })
    const edits = apply([deadline])
    expect(added(edits)).toMatchObject({ kind: 'milestone', allDay: true, availability: 'free' })
    expect(deadlineOf(planOf(edits), 'journey')).toBe('2027-02-16')
    const stored = JSON.stringify(edits)
    expect(deadlineOf(planOf(parseEdits(JSON.parse(stored))), 'journey')).toBe('2027-02-16')
  })

  test('a milestone is one day at midnight and never repeats', () => {
    expect(milestone({ end: '2027-02-17T00:00' })).toThrow(/a milestone starts and ends at 00:00 of its day/)
    expect(milestone({ start: '2027-02-16T10:00', end: '2027-02-16T10:00' })).toThrow(/00:00/)
    expect(milestone({ rrule: 'FREQ=WEEKLY;BYDAY=TU' })).toThrow(/a milestone never repeats/)
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

const ids = (plan: Plan) => plan.calendars.map((c) => c.id)

describe('calendar order and visibility', () => {
  const natural = ids(base)

  test('calendars.order puts the calendars named first and keeps the others after them, in their own order', () => {
    expect(ids(planOf(apply([EXAMPLES['calendars.order']])))).toEqual([
      'personal',
      'certs',
      ...natural.filter((id) => id !== 'personal' && id !== 'certs'),
    ])
  })

  test('the natural order again is no edit at all', () => {
    const edits = apply([EXAMPLES['calendars.order'], { type: 'calendars.order', ids: natural }])
    expect(edits.order).toBeUndefined()
  })

  test('calendars.order refuses a calendar that is not in the plan, and a calendar named twice', () => {
    expect(() => apply([{ type: 'calendars.order', ids: ['certs', 'nope'] }])).toThrow(/nope/)
    expect(() => parseChange({ type: 'calendars.order', ids: ['certs', 'certs'] })).toThrow(/each once/)
  })

  test('a hidden calendar keeps its events in the plan; showing it again leaves no edit', () => {
    const hidden = apply([EXAMPLES['calendar.hide']])
    const plan = planOf(hidden)
    expect(plan.calendars.find((c) => c.id === 'journey')?.hidden).toBe(true)
    expect(plan.events.some((e) => e.calendar === 'journey')).toBe(true)
    expect(apply([{ type: 'calendar.hide', id: 'journey', hidden: false }], hidden).hidden).toBeUndefined()
  })

  test('the last calendar shown cannot be hidden', () => {
    const all = natural.map((id): PlanChange => ({ type: 'calendar.hide', id, hidden: true }))
    expect(() => apply(all)).toThrow(/last calendar/)
  })

  test('the order and the hidden calendars survive a trip through the edits file', () => {
    const edits = apply([EXAMPLES['calendars.order'], EXAMPLES['calendar.hide']])
    const stored = JSON.stringify(edits)
    expect(parseEdits(JSON.parse(stored))).toEqual(edits)
  })

  test('shownPlan leaves out a hidden calendar and its events, and nothing else', () => {
    const plan = planOf(apply([EXAMPLES['calendar.hide']]))
    const shown = shownPlan(plan)
    expect(ids(shown)).toEqual(natural.filter((id) => id !== 'journey'))
    expect(shown.events).toEqual(plan.events.filter((e) => e.calendar !== 'journey'))
    expect(shownPlan(base)).toBe(base)
  })
})

const labelsOf = (edits: PlanEdits, id: string) => planOf(edits).calendars.find((c) => c.id === id)?.labels
const tag = (id: string, labels: string[]): PlanChange => ({ type: 'calendar.labels', id, labels })

describe('labels', () => {
  test('a label is kept trimmed, once per calendar whatever its case, and the first spelling wins', () => {
    expect(
      parseChange({ type: 'calendar.labels', id: 'journey', labels: ['  Google   Skills ', 'google skills', 7] }),
    ).toEqual(tag('journey', ['Google Skills']))
    expect(() => parseChange({ type: 'calendar.labels', id: 'journey', labels: 'Partners' })).toThrow(/labels/)
  })

  test('calendar.labels gives the whole list; an empty one takes every label off and leaves no edit', () => {
    const tagged = apply([EXAMPLES['calendar.labels']])
    expect(labelsOf(tagged, 'journey')).toEqual(['Partners', 'Certification'])
    expect(labelsOf(tagged, 'certs')).toBeUndefined()
    expect(apply([tag('journey', [])], tagged).labels).toBeUndefined()
    expect(() => apply([tag('nope', ['Partners'])])).toThrow('Unknown calendar "nope"')
  })

  test('label.rename renames the label on every calendar, merging it into one the calendar already has', () => {
    const tagged = apply([tag('journey', ['Partners', 'Google']), tag('certs', ['partners'])])
    const renamed = apply([{ type: 'label.rename', from: 'PARTNERS', to: 'Google' }], tagged)
    expect(labelsOf(renamed, 'journey')).toEqual(['Google'])
    expect(labelsOf(renamed, 'certs')).toEqual(['Google'])
  })

  test('label.rename to null takes the label off every calendar; an unknown label is refused', () => {
    const tagged = apply([tag('journey', ['Partners']), tag('certs', ['Partners', 'Exam'])])
    const removed = apply([{ type: 'label.rename', from: 'partners', to: null }], tagged)
    expect(removed.labels).toEqual({ certs: ['Exam'] })
    expect(() => apply([{ type: 'label.rename', from: 'Nope', to: null }], tagged)).toThrow('Unknown label "Nope"')
  })

  test('course.add gives the new calendar its labels', () => {
    const edits = apply([{ ...EXAMPLES['course.add'], labels: ['Partners'] }])
    const [id] = Object.keys(edits.calendars)
    expect(labelsOf(edits, id ?? '')).toEqual(['Partners'])
  })

  test('labels survive a trip through the edits file', () => {
    const edits = apply([EXAMPLES['calendar.labels']])
    const stored = JSON.stringify(edits)
    expect(parseEdits(JSON.parse(stored))).toEqual(edits)
  })

  test('a calendar purged from the trash takes its labels with it', () => {
    const course = apply([{ ...EXAMPLES['course.add'], labels: ['Partners'] }])
    const [id = ''] = Object.keys(course.calendars)
    const removed = apply([{ type: 'calendar.remove', id }], course)
    expect(removed.labels).toEqual({ [id]: ['Partners'] })
    expect(purgeTrash(base, removed, NOW + (TRASH_DAYS + 1) * 86_400_000).labels).toBeUndefined()
  })

  test('label.hide hides every calendar with the label as one step, and shows them again', () => {
    const tagged = apply([tag('journey', ['Partners']), tag('certs', ['partners'])])
    const hidden = apply([EXAMPLES['label.hide']], tagged)
    expect(hidden.hidden?.toSorted()).toEqual(['certs', 'journey'])
    expect(apply([{ ...EXAMPLES['label.hide'], hidden: false }], hidden).hidden).toBeUndefined()
    expect(() => apply([{ type: 'label.hide', label: 'Nope', hidden: true }], tagged)).toThrow('Unknown label "Nope"')
  })

  test('label.hide keeps one calendar shown', () => {
    const all = ids(base).map((id) => tag(id, ['Everything']))
    expect(() => apply([...all, { type: 'label.hide', label: 'Everything', hidden: true }])).toThrow(/last calendar/)
  })

  test('groupByLabel puts an item under each label of its calendar, then the ones without', () => {
    const items = [
      { id: 'a', labels: ['Partners', 'Exam'] },
      { id: 'b', labels: ['partners'] },
      { id: 'c', labels: [] },
    ]
    const groups = groupByLabel(items, (item) => item)
    expect(groups.map((g) => [g.label, g.items.map((item) => item.id)])).toEqual([
      ['Partners', ['a', 'b']],
      ['Exam', ['a']],
      [null, ['c']],
    ])
    expect(countsTwice(groups)).toBe(true)
    const plain: { id: string; labels?: string[] } = { id: 'd' }
    expect(groupByLabel([plain], (item) => item)).toEqual([{ label: null, items: [plain] }])
    expect(countsTwice(groupByLabel(items.slice(1), (item) => item))).toBe(false)
  })

  test('planLabels lists each label once, in the order of the first calendar carrying it', () => {
    const plan = planOf(apply([tag('certs', ['Exam', 'Partners']), tag('journey', ['partners', 'Own'])]))
    const firsts = plan.calendars.map((c) => c.id)
    expect(firsts.indexOf('certs')).toBeLessThan(firsts.indexOf('journey'))
    expect(planLabels(plan)).toEqual([
      { name: 'Exam', calendars: ['certs'] },
      { name: 'Partners', calendars: ['certs', 'journey'] },
      { name: 'Own', calendars: ['journey'] },
    ])
  })
})

const skip = (uid: string): PlanChange => ({ type: 'event.patch', uid, patch: { done: true, skipped: true } })
/** A session of a two-session module that ended before `NOW` */
const probe = (n: number) =>
  session({ title: `Probe — Probe module (${n}/2)`, start: `2026-11-2${n}T10:00`, end: `2026-11-2${n}T11:00` })
const offered = (edits: PlanEdits) => reviewOffers(planOf(edits), NOW).some((offer) => offer.title.includes('Probe'))

describe('skipped', () => {
  test('a skipped session is no open work, and every count of success takes it as missed', () => {
    const plan = planOf(apply([skip(SESSION), { type: 'events.done', uids: [NEXT], done: true }]))
    const skipped = find(plan, SESSION)
    expect(skipped).toMatchObject({ done: true, skipped: true })
    // Done with, so the planner does not ask for the time it took.
    expect(skipped && doneWithoutTime(skipped)).toBe(false)
    const certs = courseProgress(plan).find((c) => c.calendar.id === 'certs')
    expect(certs).toMatchObject({ doneSessions: 1, skippedSessions: 1 })
    const monday = parseLocal('2026-11-23T00:00')
    const review = weekReview(plan, monday, NOW)
    expect(review.skipped).toBe(1)
    expect(review.missed).toBeGreaterThanOrEqual(1)
    expect(planStats(plan, NOW).doneSessions).toBe(1)
  })

  test('marking it not done brings it back as open work and drops the skipped mark', () => {
    const edits = apply([skip(SESSION), { type: 'event.patch', uid: SESSION, patch: { done: false } }])
    expect(edits.events[SESSION]).toBeUndefined()
    expect(find(planOf(edits), SESSION)?.skipped).toBeUndefined()
  })

  test('skipped survives the edits file, and an added session keeps it too', () => {
    const edits = apply([EXAMPLES['event.add']])
    const { uid } = added(edits)
    const both = apply([skip(SESSION), skip(uid)], edits)
    const stored = JSON.stringify(both)
    const again = parseEdits(JSON.parse(stored))
    expect(again).toEqual(both)
    expect(find(planOf(again), uid)).toMatchObject({ done: true, skipped: true })
  })

  test('skipping drops the time logged for the session', () => {
    const edits = apply([
      { type: 'events.done', uids: [SESSION], done: true, actual: { [SESSION]: 45 } },
      skip(SESSION),
    ])
    expect(find(planOf(edits), SESSION)?.actual).toBeUndefined()
  })

  test('a module that was only skipped offers no reviews; one session done is enough', () => {
    const one = apply([{ type: 'event.add', event: probe(1) }])
    const first = added(one).uid
    const both = apply([{ type: 'event.add', event: probe(2) }], one)
    const second = added(both).uid
    expect(offered(apply([skip(first), skip(second)], both))).toBe(false)
    expect(offered(apply([skip(first), { type: 'events.done', uids: [second], done: true }], both))).toBe(true)
  })
})

/** The same time eight days on: past the end of the week */
const later = (t: string) => toLocalString(parseLocal(t) + 8 * DAY)
const REVIEW: PlanChange = { type: 'week.review', week: '2026-11-23', note: '  Two modules done, one missed ' }
const notesOf = (edits: PlanEdits) => planOf(edits).weekNotes ?? []

describe('week review', () => {
  test("keeps the note with the week's numbers as they are now, and saving again replaces it", () => {
    const done = apply([{ type: 'events.done', uids: [SESSION], done: true }])
    const once = apply([REVIEW], done)
    const [note] = notesOf(once)
    expect(notesOf(once)).toHaveLength(1)
    expect(note).toMatchObject({ week: '2026-11-23', note: 'Two modules done, one missed', missed: 0, skipped: 0 })
    expect(note?.done).toBeGreaterThan(0)
    expect(note?.planned).toBeGreaterThanOrEqual(note?.done ?? 0)
    const again = apply([{ type: 'week.review', week: '2026-11-23', note: 'Better' }], once)
    expect(notesOf(again).map((n) => n.note)).toEqual(['Better'])
  })

  test('the weeks stay in date order and survive the edits file', () => {
    const edits = apply([{ type: 'week.review', week: '2026-11-30', note: 'Later' }, REVIEW])
    expect(notesOf(edits).map((n) => n.week)).toEqual(['2026-11-23', '2026-11-30'])
    const stored = JSON.stringify(edits)
    expect(parseEdits(JSON.parse(stored))).toEqual(edits)
  })

  test('a reviewed week keeps the numbers of its review: a missed session moved on later stays missed there', () => {
    const sunday = Date.parse('2026-11-29T18:00:00Z')
    const missed = find(base, SESSION)
    const move: PlanChange = {
      type: 'event.patch',
      uid: SESSION,
      patch: { start: later(missed?.start ?? ''), end: later(missed?.end ?? '') },
    }
    const firstWeek = (edits: PlanEdits) => weekOutcomes(planOf(edits), toMinsk(sunday)).at(0)
    const kept = firstWeek(apply([REVIEW, move], emptyEdits(), sunday))
    const live = firstWeek(apply([move], emptyEdits(), sunday))
    expect(kept).toMatchObject({ monday: parseLocal('2026-11-23T00:00'), note: 'Two modules done, one missed' })
    expect(live).toMatchObject({ monday: parseLocal('2026-11-23T00:00'), note: null })
    expect(kept?.missed).toBe((live?.missed ?? 0) + 1)
  })

  test('a week is named by its Monday, and an update cannot carry a review: it stays with the person', () => {
    expect(() => parseChange({ type: 'week.review', week: '2026-11-24', note: '' })).toThrow(/Monday/)
    expect(() => parseUpdate({ changes: [REVIEW] })).toThrow()
  })
})

describe('settings', () => {
  test('the weekly budget and the day limit go into the meta, and back out', () => {
    const set = apply([
      { type: 'plan.budget', hours: 10 },
      { type: 'plan.dayLimit', hours: 3 },
    ])
    expect(planOf(set).meta).toMatchObject({ weeklyBudgetHours: 10, dayLimit: 3 })
    const back = apply(
      [
        { type: 'plan.budget', hours: base.meta.weeklyBudgetHours },
        { type: 'plan.dayLimit', hours: null },
      ],
      set,
    )
    expect(back.budget).toBeUndefined()
    expect(planOf(back).meta.dayLimit).toBeUndefined()
    expect(parseEdits(structuredClone(set))).toEqual(set)
  })

  test('hours are kept to the half hour inside their range, and an update cannot carry them', () => {
    expect(parseChange({ type: 'plan.dayLimit', hours: 2.3 })).toEqual({ type: 'plan.dayLimit', hours: 2.5 })
    expect(() => parseChange({ type: 'plan.budget', hours: 0 })).toThrow(/hours/)
    expect(() => parseChange({ type: 'plan.dayLimit', hours: 20 })).toThrow(/hours/)
    expect(() => parseUpdate({ changes: [{ type: 'plan.budget', hours: 10 }] })).toThrow()
  })
})

describe('several sessions', () => {
  test('events.shift moves the open sessions of one calendar and leaves the done ones', () => {
    const done = apply([{ type: 'events.done', uids: [SESSION], done: true }])
    const plan = planOf(apply([EXAMPLES['events.shift']], done))
    expect(find(plan, SESSION)?.start).toBe(itemAt(base.events).start)
    expect(find(plan, NEXT)?.start).toBe('2026-11-24T13:30')
    expect(find(plan, GYM)?.start).toBe(find(base, GYM)?.start)
  })

  test('events.shift moves the calendars named and leaves the others', () => {
    const [llm, python] = [firstSessionOf('hfllm'), firstSessionOf('pypy')]
    const plan = planOf(apply([{ ...shift({ days: 7 }), calendars: ['certs', 'hfllm'] }]))
    expect(find(plan, SESSION)?.start).toBe('2026-11-30T12:00')
    expect(find(plan, llm?.uid ?? '')?.start).toBe(toLocalString(parseLocal(llm?.start ?? '') + 7 * 86_400_000))
    expect(find(plan, python?.uid ?? '')?.start).toBe(python?.start)
  })

  test('events.shift reads the one calendar of a change stored before it took several', () => {
    expect(parseChange({ type: 'events.shift', calendar: 'certs', from: '2026-11-23', days: 1 })).toEqual({
      type: 'events.shift',
      calendars: ['certs'],
      from: '2026-11-23',
      days: 1,
    })
  })

  test('events.shift takes a list of calendars, each once, or none for all', () => {
    expect(parseShift({ days: 1, calendars: [] })).toThrow(/calendars/)
    expect(parseShift({ days: 1, calendars: 'certs' })).toThrow(/calendars/)
    expect(parseShift({ days: 1, calendars: ['certs', 'certs'] })).toThrow(/calendars/)
    expect(() => apply([{ ...shift({ days: 1 }), calendars: ['certs', 'nope'] }])).toThrow('Unknown calendar "nope"')
  })

  test('a shift of several calendars is one step, named after them', () => {
    const change = EXAMPLES['events.shift']
    const history = recordChange(emptyHistory(), base, change, apply([change]))
    expect(history.steps[0]?.subject).toBe('Gemini Certs, Hugging Face: LLM Course')
  })

  test('events.shift by hours moves the start and keeps the length', () => {
    const plan = planOf(apply([shift({ hours: 1 })]))
    expect(find(base, SESSION)?.start).toBe('2026-11-23T12:00')
    expect(find(plan, SESSION)?.start).toBe('2026-11-23T13:00')
    expect(length(find(plan, SESSION))).toBe(length(find(base, SESSION)))
  })

  test('events.shift combines days and hours', () => {
    expect(find(planOf(apply([shift({ days: 1, hours: -1 })])), SESSION)?.start).toBe('2026-11-24T11:00')
  })

  test('events.shift takes whole or half hours and something to shift by', () => {
    expect(parseShift({ hours: 0.25 })).toThrow(/hours must be whole or half/)
    expect(parseShift({ hours: 24 })).toThrow(/hours must be whole or half/)
    expect(parseShift({})).toThrow(/days or hours/)
    expect(parseShift({ days: 0, hours: 0 })).toThrow(/days or hours/)
    expect(parseShift({ hours: -1.5 })()).toEqual({ type: 'events.shift', from: '2026-11-23', hours: -1.5 })
  })

  test('events.shift refuses a session that would cross midnight and moves nothing', () => {
    const late = apply([
      { type: 'event.patch', uid: NEXT, patch: { start: '2026-11-23T22:30', end: '2026-11-23T23:30' } },
    ])
    const title = find(base, NEXT)?.title ?? ''
    expect(() => apply([shift({ hours: 1 })], late)).toThrow(`"${title}" would cross midnight`)
    expect(() => apply([shift({ hours: -13 })])).toThrow(/would cross midnight/)
  })

  test('events.shift refuses when nothing would move', () => {
    expect(() => apply([{ ...EXAMPLES['events.shift'], from: '2030-01-01' }])).toThrow(/No sessions/)
  })

  test('events.move moves all as one step and marks them paced when asked', () => {
    const plan = planOf(apply([{ ...EXAMPLES['events.move'], paced: true }]))
    expect(find(plan, SESSION)).toMatchObject({ start: '2026-11-23T19:00', paced: true })
  })

  test('a re-balance is one step of the history, named after its calendar', () => {
    const change = EXAMPLES['events.move']
    const history = recordChange(emptyHistory(), base, change, apply([change]))
    expect(history.steps).toHaveLength(1)
    expect(history.steps[0]?.subject).toBe(base.calendars.find((c) => c.id === 'certs')?.name)
  })

  test('events.move refuses an unknown reason', () => {
    expect(() => parseChange({ ...EXAMPLES['events.move'], reason: 'tidy' })).toThrow(/reason/)
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

  test('plan.countdown names the calendar whose deadline the countdown follows; null names none again', () => {
    const chosen = apply([EXAMPLES['plan.countdown']])
    expect(planOf(chosen).meta.countdown).toBe('hfllm')
    const cleared = apply([{ type: 'plan.countdown', calendar: null }], chosen)
    expect(cleared.countdown).toBeUndefined()
    expect(planOf(cleared).meta.countdown).toBeUndefined()
    expect(() => apply([{ type: 'plan.countdown', calendar: 'nope' }])).toThrow('Unknown calendar "nope"')
  })

  test('calendar.save renames a calendar, or creates one without an id', () => {
    expect(planOf(apply([EXAMPLES['calendar.save']])).calendars.find((c) => c.id === 'journey')?.name).toBe('Journey')
    const created = planOf(apply([{ type: 'calendar.save', name: 'Reading', color: '#445566' }]))
    expect(created.calendars.some((c) => c.name === 'Reading' && c.custom)).toBe(true)
  })
})

describe('event.split', () => {
  test('the first part keeps the event, the others are new events with its title', () => {
    const edits = apply([EXAMPLES['event.split']])
    expect(find(planOf(edits), SESSION)).toMatchObject({ start: '2026-11-23T12:00', end: '2026-11-23T12:30' })
    const part = added(edits)
    expect(part).toMatchObject({ title: itemAt(base.events).title, start: '2026-11-26T18:00', calendar: 'certs' })
    expect(part.uid).not.toBe(SESSION)
  })

  test('the parts must add up to the session, each on one day', () => {
    const { parts } = EXAMPLES['event.split']
    const [first, second] = [itemAt(parts), itemAt(parts, 1)]
    const longer = {
      ...EXAMPLES['event.split'],
      parts: [first, { start: '2026-11-26T18:00', end: '2026-11-26T19:00' }],
    }
    expect(() => apply([longer])).toThrow(/add up/)
    const overnight = {
      ...EXAMPLES['event.split'],
      parts: [{ start: '2026-11-23T23:45', end: '2026-11-24T00:15' }, second],
    }
    expect(() => apply([overnight])).toThrow(/same day/)
  })

  test('a lab, a repeat and a finished session stay whole', () => {
    const lab = itemAt(base.events.filter((e) => e.kind === 'lab'))
    expect(() => apply([{ ...EXAMPLES['event.split'], uid: lab.uid }])).toThrow(/lab/)
    expect(() => apply([{ ...EXAMPLES['event.split'], uid: GYM }])).toThrow(/repeating/)
    const done = apply([{ type: 'events.done', uids: [SESSION], done: true }])
    expect(() => apply([EXAMPLES['event.split']], done)).toThrow(/finished/)
  })

  test('splitInHalves cuts on the half hour and leaves out what cannot be split', () => {
    const event = itemAt(base.events)
    const long = { ...event, start: '2026-11-23T12:00', end: '2026-11-23T13:30' }
    expect(splitInHalves(long)?.parts).toEqual([
      { start: '2026-11-23T12:00', end: '2026-11-23T13:00' },
      { start: '2026-11-23T13:00', end: '2026-11-23T13:30' },
    ])
    expect(splitInHalves({ ...event, end: '2026-11-23T12:30' })).toBeNull()
    expect(splitInHalves({ ...event, kind: 'lab' })).toBeNull()
  })
})

/** The stopwatch stopped after 25 minutes */
const finish25 = (uid: string, began: string): PlanChange => ({
  type: 'session.finish',
  uid,
  actual: 25,
  began,
  paused: 0,
})

describe('session.continue', () => {
  const continued = EXAMPLES['session.continue']
  const tryOn = (uid: string) => () => apply([{ ...continued, uid }])

  test('adds a sitting linked to the session and marks the latest done sitting unfinished', () => {
    const edits = apply([finish25(SESSION, '2026-11-23T12:00'), continued])
    const root = itemAt(base.events.filter((e) => e.uid === SESSION))
    expect(added(edits)).toMatchObject({
      from: SESSION,
      start: '2026-11-26T18:00',
      end: '2026-11-26T18:35',
      kind: 'study',
      calendar: root.calendar,
      title: root.title,
      description: root.description,
      availability: root.availability,
    })
    expect(added(edits).uid).toMatch(/^custom-.+@learning-curve$/)
    for (const key of ['done', 'actual', 'estimate', 'unfinished']) expect(added(edits)).not.toHaveProperty(key)
    expect(find(planOf(edits), SESSION)?.unfinished).toBe(true)
    expect(parseEdits(structuredClone(edits))).toEqual(edits)
  })

  test('a sitting continued from a sitting links to the root', () => {
    const first = apply([finish25(SESSION, '2026-11-23T12:00'), continued])
    const { uid } = added(first)
    const renamed = apply(
      [{ type: 'event.patch', uid, patch: { title: 'Renamed' } }, finish25(uid, '2026-11-26T18:00')],
      first,
    )
    const again = { ...continued, uid, start: '2026-11-27T18:00', end: '2026-11-27T18:15' }
    const second = apply([again], renamed)
    expect(added(second)).toMatchObject({ from: SESSION, start: '2026-11-27T18:00', title: find(base, SESSION)?.title })
    expect(find(planOf(second), uid)?.unfinished).toBe(true)
    // Without its root in the plan the group is named by the sitting asked for.
    const orphan = apply([{ type: 'event.remove', uid: SESSION }, again], renamed)
    expect(added(orphan)).toMatchObject({ from: SESSION, title: 'Renamed' })
  })

  test('the mark goes on the latest sitting worked, not on a skipped one', () => {
    const split = apply([EXAMPLES['event.split'], { type: 'events.done', uids: [SESSION], done: true }])
    const part = added(split).uid
    const edits = apply(
      [
        { type: 'event.patch', uid: part, patch: { done: true, skipped: true } },
        { ...continued, start: '2026-11-27T18:00', end: '2026-11-27T18:30' },
      ],
      split,
    )
    expect(find(planOf(edits), SESSION)?.unfinished).toBe(true)
  })

  test('the history names it after the session', () => {
    const history = recordChange(emptyHistory(), base, continued, apply([continued]))
    expect(history.steps[0]?.subject).toBe(find(base, SESSION)?.title)
  })

  test('may end at the next midnight and not later', () => {
    const late = { ...continued, start: '2026-11-26T23:40' }
    expect(() => apply([{ ...late, end: '2026-11-27T00:00' }])).not.toThrow()
    expect(() => apply([{ ...late, end: '2026-11-27T00:15' }])).toThrow(/midnight/)
  })

  test('a repeat, an all-day event and a free event cannot be continued', () => {
    const allDay = itemAt(base.events.filter((e) => e.allDay))
    const free = itemAt(base.events.filter((e) => e.availability === 'free' && !e.allDay))
    expect(tryOn(GYM)).toThrow(/repeating/)
    expect(tryOn(allDay.uid)).toThrow(/all-day/)
    expect(tryOn(free.uid)).toThrow(/only a session/)
  })

  test('a lab gets another sitting as a lab: a sitting is not a pause', () => {
    const lab = itemAt(base.events.filter((e) => e.kind === 'lab'))
    expect(added(apply([{ ...continued, uid: lab.uid }]))).toMatchObject({ kind: 'lab', from: lab.uid })
  })

  test('an unknown uid, a time that is not one and an end before the start are refused', () => {
    expect(tryOn('nope')).toThrow('Unknown event "nope"')
    expect(() => parseChange({ ...continued, start: '2026-11-26 18:00' })).toThrow(/2026-11-23T12:00/)
    expect(() => parseChange({ ...continued, end: undefined })).toThrow(/end/)
    expect(() => apply([{ ...continued, end: '2026-11-26T17:30' }])).toThrow(/end after/)
    expect(() => apply([{ ...continued, end: continued.start }])).toThrow(/end after/)
  })
})
