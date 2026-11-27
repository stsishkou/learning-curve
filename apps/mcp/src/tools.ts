import { UPDATE_SCHEMA } from '@lc/plan-domain/protocol'

const DAY = String.raw`^\d{4}-\d{2}-\d{2}$`
const HOUR = String.raw`^([01]\d|2[0-3]):(00|30)$`

/** The tools of the server, as `tools/list` answers them. */
export const TOOLS = [
  {
    name: 'get_guide',
    title: 'Read the plan guide',
    description:
      'The instructions for working with this study plan: how it is laid out, its rules (weekly budget, holidays, naming), how to add a course, how to mark something as repeating and how to write an update. Call it first, before any other tool, and again after the plan changed: it lists the calendars and the hours already planned per week.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_plan',
    title: 'Read the plan',
    description:
      'The study plan as JSON (calendars and events with their uids), described by the resource plan://schema/plan. Narrow it with `calendar`, `from` and `to` when you need only a part; ask for `descriptions` only when you need the notes of the events, they make the answer several times longer.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        calendar: { type: 'string', description: 'Only the events of the calendar with this `id`.' },
        from: {
          type: 'string',
          pattern: DAY,
          description: 'Only events that start on this day or later, "YYYY-MM-DD".',
        },
        to: {
          type: 'string',
          pattern: DAY,
          description: 'Only events that start on this day or earlier, "YYYY-MM-DD".',
        },
        descriptions: { type: 'boolean', default: false, description: 'Include the `description` of every event.' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_accuracy',
    title: 'Read how long sessions really take',
    description:
      'How the times logged on done sessions compare with their plan. Per course and per kind of session: the done, logged and unlogged counts, the pace (real ÷ planned hours, what a forecast multiplies by) and the typical session (geometric mean of real ÷ planned, with its 95% interval), both null below `minLogged` logged sessions. Per course also the hours left and the finish: as planned, at its pace, and the range by which half and nine in ten of simulated futures are done. Read it before resizing sessions to a pace or choosing the length of a new session, and quote the number of logged sessions with any ratio.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        calendar: {
          type: 'string',
          description: 'Only the course of the calendar with this `id`; the kinds stay those of every course.',
        },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'preview_update',
    title: 'Check an update without storing it',
    description:
      'Works out what an update would do: events added, removed and changed, calendars created, weeks filled past the weekly budget, the first change that does not fit the plan, and warnings for the rules of the plan it breaks (holidays, weekends, overlapping events, course deadlines, finished sessions). Nothing is stored. Call it before apply_update and show the person the result.',
    inputSchema: UPDATE_SCHEMA,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'apply_update',
    title: 'Apply an update to the plan',
    description:
      "Stores an update: every change becomes one step of the plan's history, which the person can undo in the viewer. All or nothing: when one change does not fit, nothing is stored and the reason comes back. Call it only after the person agreed to what preview_update showed.",
    inputSchema: UPDATE_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'rebalance_calendar',
    title: 'Re-balance a calendar',
    description:
      'Works out new days and times for the sessions of one calendar from a day on, keeping the order of the course: evenly at a rhythm (sessions a study day), or towards a deadline (the calendar\'s milestone unless one is given), inside the study hours and the weekly budget, around holidays, other events and the person\'s busy time. Nothing is stored. The answer is an `update` (an events.move with reason "rebalance"; null when nothing moves, or while a session finds no room, as the rest would move around it) to check with preview_update and store with apply_update once the person agrees, and a `report`: the finish, the heaviest week and day, weeks over the budget, late and unplaced sessions, and the reasons nothing better exists. It can take several seconds.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['calendar', 'from', 'mode'],
      properties: {
        calendar: { type: 'string', description: 'The `id` of the calendar to re-balance.' },
        from: { type: 'string', pattern: DAY, description: 'Its sessions from this day on move, "YYYY-MM-DD".' },
        mode: {
          type: 'string',
          enum: ['rhythm', 'deadline'],
          description:
            '`rhythm`: a steady number of sessions a study day. `deadline`: done before the deadline, evenly.',
        },
        perDay: {
          type: 'number',
          exclusiveMinimum: 0,
          description: 'Sessions a study day, for `rhythm`: 1/3, 1/2, 1, 3/2, 2 or 3 (0.5 is one every two days).',
        },
        deadline: {
          type: 'string',
          pattern: DAY,
          description: "For `deadline`: the day everything is done before. The calendar's milestone when left out.",
        },
        overBudget: {
          type: 'boolean',
          default: false,
          description: 'Allow weeks past the weekly budget when nothing else fits.',
        },
        hoursFrom: {
          type: 'string',
          pattern: HOUR,
          description: 'The study hours start, "HH:MM" on the half hour. The usual hours of the plan when left out.',
        },
        hoursTo: { type: 'string', pattern: HOUR, description: 'The study hours end, "HH:MM" on the half hour.' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
]

/** The documents of the server, as `resources/list` answers them. */
export const RESOURCES = [
  {
    uri: 'plan://guide',
    name: 'Plan guide',
    mimeType: 'text/markdown',
    description: 'How to work with the plan and write updates.',
  },
  {
    uri: 'plan://plan',
    name: 'Study plan',
    mimeType: 'application/json',
    description: 'The whole plan with event descriptions.',
  },
  {
    uri: 'plan://schema/plan',
    name: 'Plan schema',
    mimeType: 'application/schema+json',
    description: 'JSON Schema of the plan file.',
  },
  {
    uri: 'plan://schema/update',
    name: 'Update schema',
    mimeType: 'application/schema+json',
    description: 'JSON Schema of an update.',
  },
]
/** The one prompt of the server: the guide and the plan in one message. */
export const PROMPT = {
  name: 'change_plan',
  title: 'Change the study plan',
  description: 'The guide and the plan in one message, with what you want to change.',
  arguments: [{ name: 'request', description: 'What to change, in your own words', required: false }],
}
