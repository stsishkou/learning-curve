import { expect, test } from 'vitest'

import { parseModules, planCourse, type CourseInput } from './course-plan'
import { parseLocal } from './dates'
import type { Plan, PlanEvent } from './types'
import { previewUpdate } from './update'

const busy = (uid: string, start: string, end: string, more: Partial<PlanEvent> = {}): PlanEvent => ({
  uid,
  calendar: 'other',
  title: uid,
  start,
  end,
  description: '',
  kind: 'study',
  availability: 'busy',
  ...more,
})

const planOf = (events: PlanEvent[] = [], meta: Partial<Plan['meta']> = {}): Plan => ({
  meta: {
    title: 'Plan',
    version: 1,
    timezone: 'Europe/Minsk',
    generated: '2026-11-25',
    weeklyBudgetHours: 12,
    holidays: [],
    planEnd: '2027-03-01',
    ...meta,
  },
  calendars: [{ id: 'other', name: 'Other', color: '#6b7280', isNew: false }],
  events,
})

const NOW = parseLocal('2026-11-25T09:00')

// Mondays and Wednesdays from Monday Nov 30, two sessions an evening from 19:00.
const input = (more: Partial<CourseInput> = {}): CourseInput => ({
  name: 'Agents Course',
  short: 'Agents',
  color: '#0f8fc4',
  labels: [],
  link: '',
  modules: [{ title: 'Intro', minutes: 150, lab: false }],
  firstDay: '2026-11-30',
  weekdays: [1, 3],
  start: '19:00',
  perDay: 2,
  deadline: null,
  ...more,
})

const slots = (plan: Plan, course: CourseInput) =>
  planCourse(plan, course, NOW).change.sessions.map((s) => `${s.start}–${s.end.slice(11)} ${s.title}`)

test('a Google Skills path copied from its page gives its modules, lengths and labs', () => {
  const text = [
    'Course',
    'Accelerate Agent Development with Antigravity and Agents CLI',
    '33%',
    'course iconCourse',
    'Build with the Managed Agents API on Gemini platform',
    'pace',
    '2 hours 30 minutes',
    'course iconCourse',
    'award_star',
    'Skill badge',
    'Accelerate Development with Antigravity',
    'pace',
    '1 hour 45 minutes',
    'course iconCourse',
    'Upgrade to the Latest Gemini Models',
    'pace',
    '1 hour',
  ].join('\n')
  expect(parseModules(text)).toEqual([
    { title: 'Accelerate Agent Development with Antigravity and Agents CLI', minutes: null, lab: false },
    { title: 'Build with the Managed Agents API on Gemini platform', minutes: 150, lab: false },
    { title: 'Accelerate Development with Antigravity', minutes: 105, lab: true },
    { title: 'Upgrade to the Latest Gemini Models', minutes: 60, lab: false },
  ])
})

test('one module a line takes its length after a dash, a colon or in brackets', () => {
  const text = [
    '- Intro — 2h 30m',
    'Model Armor: Securing AI Deployments - 90 min',
    'Lab: Deploy an agent — 1.5h',
    'Memory (45m)',
    'Wrap-up',
  ].join('\n')
  expect(parseModules(text)).toEqual([
    { title: 'Intro', minutes: 150, lab: false },
    { title: 'Model Armor: Securing AI Deployments', minutes: 90, lab: false },
    { title: 'Deploy an agent', minutes: 90, lab: true },
    { title: 'Memory', minutes: 45, lab: false },
    { title: 'Wrap-up', minutes: null, lab: false },
  ])
})

test('a module becomes one-hour sessions rounded up and numbered; a lab is one two-hour block', () => {
  const course = input({
    link: 'https://example.com/course',
    modules: [
      { title: 'Intro', minutes: 150, lab: false },
      { title: 'Badge', minutes: 90, lab: true },
      { title: 'Recap', minutes: null, lab: false },
    ],
  })
  expect(slots(planOf(), course)).toEqual([
    '2026-11-30T19:00–20:00 Agents — Intro (1/3)',
    '2026-11-30T20:00–21:00 Agents — Intro (2/3)',
    '2026-12-02T19:00–20:00 Agents — Intro (3/3)',
    '2026-12-02T20:00–22:00 Agents — Лаба 1: Badge',
    '2026-12-07T19:00–20:00 Agents — Recap',
  ])
  const [first] = planCourse(planOf(), course, NOW).change.sessions
  expect(first?.description).toBe('Course: https://example.com/course\nIntro (2 ч 30 мин), часть 1 из 3.')
})

test('sessions take only free time, skip holidays and start after the time already gone', () => {
  const plan = planOf([busy('gym', '2026-11-30T19:00', '2026-11-30T20:30')], { holidays: ['2026-12-02'] })
  expect(slots(plan, input({ firstDay: '2026-11-25', weekdays: [1, 3] }))).toEqual([
    '2026-11-25T19:00–20:00 Agents — Intro (1/3)',
    '2026-11-25T20:00–21:00 Agents — Intro (2/3)',
    '2026-11-30T20:30–21:30 Agents — Intro (3/3)',
  ])
  const late = parseLocal('2026-11-25T19:10')
  const [first] = planCourse(planOf(), input({ firstDay: '2026-11-25' }), late).change.sessions
  expect(first?.start).toBe('2026-11-25T19:30')
})

test('the weekly budget and the day limit hold', () => {
  const plan = planOf([busy('full', '2026-11-30T09:00', '2026-11-30T19:00')], { dayLimit: 11 })
  // Ten hours on Monday leave one under the day limit, and two under the budget of the week.
  expect(slots(plan, input({ modules: [{ title: 'Intro', minutes: 240, lab: false }] }))).toEqual([
    '2026-11-30T19:00–20:00 Agents — Intro (1/4)',
    '2026-12-02T19:00–20:00 Agents — Intro (2/4)',
    '2026-12-07T19:00–20:00 Agents — Intro (3/4)',
    '2026-12-07T20:00–21:00 Agents — Intro (4/4)',
  ])
})

test('the deadline comes as the milestone, and what finds no room is counted', () => {
  const course = input({ deadline: '2026-12-20', labels: ['Partner', ' '] })
  const { change, unplaced } = planCourse(planOf(), course, NOW)
  expect(change.labels).toEqual(['Partner'])
  expect(change.sessions.at(-1)).toEqual({
    title: 'Дедлайн: Agents Course',
    start: '2026-12-20T00:00',
    end: '2026-12-20T00:00',
    description: '',
    availability: 'free',
    kind: 'milestone',
  })
  expect(unplaced).toBe(0)
  expect(planCourse(planOf(), input({ weekdays: [] }), NOW).unplaced).toBe(3)
})

test('the change adds the course with no rule broken', () => {
  const plan = planOf([busy('gym', '2026-11-30T19:00', '2026-11-30T20:30')])
  const preview = previewUpdate(plan, [planCourse(plan, input({ deadline: '2026-12-20' }), NOW).change], NOW)
  expect(preview.problem).toBeNull()
  expect(preview.warnings).toEqual([])
  expect(preview.calendars.map((c) => c.name)).toEqual(['Agents Course'])
})
