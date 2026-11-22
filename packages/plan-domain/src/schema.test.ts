// The schemas, the guide and the parser describe one protocol in three places. These tests fail when they drift.
import { Ajv2020 } from 'ajv/dist/2020.js'
import { expect, test } from 'vitest'

import { fixtureNow, fixturePlan } from './fixtures'
import { compactPlan, planBrief, planGuide } from './guide'
import { buildPlan } from './schedule'
import { PLAN_SCHEMA, UPDATE_SCHEMA } from './schema'
import { parseUpdate, previewUpdate } from './update'

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validPlan = ajv.compile(PLAN_SCHEMA)
const validUpdate = ajv.compile(UPDATE_SCHEMA)

/** The JSON code blocks of the guide: the examples a model copies. */
const examples = (guide: string): unknown[] =>
  [...guide.matchAll(/```json\n([\s\S]*?)```/g)].map((block) => JSON.parse(block[1]) as unknown)

test('the generated plan and its short copy fit the plan schema', () => {
  const plan = buildPlan()
  expect(validPlan(plan), JSON.stringify(validPlan.errors)).toBe(true)
  expect(validPlan(compactPlan(fixturePlan)), JSON.stringify(validPlan.errors)).toBe(true)
})

test('every example of the guide fits the update schema, parses and applies', () => {
  const plan = buildPlan()
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
  const uid = fixturePlan.events[0].uid
  const answer = `Sure! Here is the update:\n\n\`\`\`json\n${JSON.stringify({ summary: 'Renamed', changes: [{ type: 'event.patch', uid, patch: { title: 'New' } }] })}\n\`\`\`\nTell me if you want more.`
  const update = parseUpdate(answer)
  expect(update.summary).toBe('Renamed')
  expect(previewUpdate(fixturePlan, update.changes).diff.changed).toHaveLength(1)
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
  ]
  for (const update of bad) {
    expect(validUpdate(update), JSON.stringify(update)).toBe(false)
    expect(() => parseUpdate(update), JSON.stringify(update)).toThrow()
  }
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
    calendar: fixturePlan.calendars[0].id,
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
  expect(brief).toContain(fixturePlan.events[0].uid)
  expect(brief).toContain('Add a course')
})
