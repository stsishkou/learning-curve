import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, test } from 'vitest'

import { applyChange, parseChange, splitInHalves, type NewEvent, type PlanChange } from './changes'
import { parseLocal, toLocalString } from './dates'
import { deadlineOf } from './deadlines'
import { applyEdits, emptyEdits, parseEdits, type PlanEdits } from './edits'
import { itemAt } from './fixtures'
import { emptyHistory, recordChange } from './history'
import { isSession } from './progress'
import { DEFAULT_CONFIG, buildPlan } from './schedule'
import { UPDATE_CHANGE_TYPES, UPDATE_SCHEMA } from './schema'
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
  'plan.rename': { type: 'plan.rename', title: 'Another plan' },
  'plan.countdown': { type: 'plan.countdown', calendar: 'hfllm' },
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
