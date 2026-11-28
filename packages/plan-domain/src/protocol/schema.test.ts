// The schemas, the guide and the parser describe one protocol in three places. These tests fail when they drift.
import { Ajv2020 } from 'ajv/dist/2020.js'
import { expect, test } from 'vitest'

import { fixtureBase, fixtureNow, fixturePlan, itemAt } from '../fixtures'
import { compactPlan, planBrief, planGuide } from './guide'
import { PLAN_SCHEMA, UPDATE_SCHEMA } from './schema'
import { parseUpdate, previewUpdate } from './update'

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validPlan = ajv.compile(PLAN_SCHEMA)
const validUpdate = ajv.compile(UPDATE_SCHEMA)

/** The JSON code blocks of the guide: the examples a model copies. */
const examples = (guide: string): unknown[] =>
  [...guide.matchAll(/```json\n([\s\S]*?)```/g)]
    .flatMap((block) => block[1] ?? [])
    .map((json) => JSON.parse(json) as unknown)

test('the generated plan and its short copy fit the plan schema', () => {
  const plan = fixtureBase
  expect(validPlan(plan), JSON.stringify(validPlan.errors)).toBe(true)
  expect(validPlan(compactPlan(fixturePlan)), JSON.stringify(validPlan.errors)).toBe(true)
})

test('every example of the guide fits the update schema, parses and applies', () => {
  const plan = fixtureBase
  const found = examples(planGuide(plan, fixtureNow))
  expect(found.length).toBeGreaterThanOrEqual(3)
  for (const example of found) {
    // The repeating habit is shown as one change, the others as whole updates.
    const update =
      typeof example === 'object' && example !== null && 'changes' in example ? example : { changes: [example] }
    expect(validUpdate(update), JSON.stringify(validUpdate.errors)).toBe(true)
    const { changes } = parseUpdate(update)
    expect(previewUpdate(plan, changes).problem).toBeNull()
  }
})

test('an update is read out of a chat answer', () => {
  const { uid } = itemAt(fixturePlan.events)
  const answer = `Sure! Here is the update:\n\n\`\`\`json\n${JSON.stringify({ summary: 'Renamed', changes: [{ type: 'event.patch', uid, patch: { title: 'New' } }] })}\n\`\`\`\nTell me if you want more.`
  const update = parseUpdate(answer)
  expect(update.summary).toBe('Renamed')
  expect(previewUpdate(fixturePlan, update.changes).diff.changed).toHaveLength(1)
})

test('the schema takes a done session whose goal was not met, as the parser does', () => {
  const update = {
    changes: [{ type: 'event.patch', uid: 'certs-001@learning-curve', patch: { done: true, unfinished: true } }],
  }
  expect(validUpdate(update), JSON.stringify(validUpdate.errors)).toBe(true)
  expect(parseUpdate(update).changes).toEqual(update.changes)
})

test('what the schema refuses the parser refuses too', () => {
  const bad: unknown[] = [
    { changes: [{ type: 'trash.empty' }] },
    {
      changes: [
        {
          type: 'event.add',
          event: { calendar: 'personal', title: 'x', start: '2026-11-25 07:00', end: '2026-11-25T08:00' },
        },
      ],
    },
    {
      changes: [
        {
          type: 'event.add',
          event: {
            calendar: 'personal',
            title: 'x',
            start: '2026-11-25T07:00',
            end: '2026-11-25T08:00',
            rrule: 'FREQ=DAILY',
          },
        },
      ],
    },
    {
      changes: [
        {
          type: 'course.add',
          name: 'A',
          color: 'green',
          sessions: [{ title: 'x', start: '2026-11-25T07:00', end: '2026-11-25T08:00' }],
        },
      ],
    },
    { changes: [] },
    { changes: [{ type: 'events.shift', from: '2026-11-25', hours: 0.25 }] },
    { changes: [{ type: 'events.shift', from: '2026-11-25' }] },
    { changes: [{ type: 'events.move', moves: [], reason: 'tidy' }] },
    // The first planned length is the app's to keep.
    { changes: [{ type: 'event.patch', uid: 'certs-001@learning-curve', patch: { estimate: 60 } }] },
    // Stopwatch time comes only from the Focus page.
    { changes: [{ type: 'event.patch', uid: 'certs-001@learning-curve', patch: { began: '2026-11-25T07:00' } }] },
    {
      changes: [
        { type: 'session.finish', uid: 'certs-001@learning-curve', actual: 60, began: '2026-11-25T07:00', paused: 0 },
      ],
    },
    { changes: [{ type: 'session.continue', uid: 'certs-001@learning-curve', start: '2026-11-25T07:00' }] },
  ]
  for (const update of bad) {
    expect(validUpdate(update), JSON.stringify(update)).toBe(false)
    expect(() => parseUpdate(update), JSON.stringify(update)).toThrow()
  }
})

test('the guide carries an example that continues a session', () => {
  const found = examples(planGuide(fixtureBase, fixtureNow))
  expect(found).toContainEqual(expect.objectContaining({ type: 'session.continue' }))
})

test('`from` inside a new event is refused by the schema and dropped by the parser', () => {
  const update = {
    changes: [
      {
        type: 'event.add',
        event: {
          calendar: 'personal',
          title: 'x',
          start: '2026-11-25T07:00',
          end: '2026-11-25T08:00',
          from: 'certs-001@learning-curve',
        },
      },
    ],
  }
  expect(validUpdate(update)).toBe(false)
  const [change] = parseUpdate(update).changes
  expect(change?.type).toBe('event.add')
  expect(change?.type === 'event.add' && 'from' in change.event).toBe(false)
})

test('continuing a finished session is logging, not a change to it', () => {
  const { uid } = itemAt(fixtureBase.events.filter((e) => e.kind === 'study' && !e.done))
  const { changes } = parseUpdate({
    changes: [
      { type: 'events.done', uids: [uid], done: true, actual: { [uid]: 25 } },
      { type: 'session.continue', uid, start: '2026-11-26T18:00', end: '2026-11-26T18:35' },
    ],
  })
  const preview = previewUpdate(fixtureBase, changes, fixtureNow)
  expect(preview.problem).toBeNull()
  expect(preview.warnings.filter((w) => w.rule === 'done')).toEqual([])
})

test('a change that does not fit the plan stops the update and names itself', () => {
  const { changes } = parseUpdate({
    changes: [
      { type: 'plan.rename', title: 'Next' },
      { type: 'event.remove', uid: 'nope@learning-curve' },
    ],
  })
  expect(previewUpdate(fixturePlan, changes).problem).toEqual({
    index: 1,
    message: 'Unknown event "nope@learning-curve"',
  })
})

test('a week filled past the budget is reported', () => {
  const day = '2026-11-28'
  const events = Array.from({ length: 6 }, (_, i) => ({
    calendar: itemAt(fixturePlan.calendars).id,
    title: `Extra — Session (${i + 1}/6)`,
    start: `${day}T${String(8 + 2 * i).padStart(2, '0')}:00`,
    end: `${day}T${String(10 + 2 * i).padStart(2, '0')}:00`,
  }))
  const { changes } = parseUpdate({ changes: [{ type: 'events.add', events }] })
  expect(previewUpdate(fixturePlan, changes).overBudget.map((w) => w.week)).toContain('2026-11-23')
})

test('the brief carries the guide, the plan and the request', () => {
  const brief = planBrief(fixturePlan, fixtureNow, { request: 'Add a course' })
  expect(brief).toContain('## How to add a new course')
  expect(brief).toContain(itemAt(fixturePlan.events).uid)
  expect(brief).toContain('Add a course')
})
