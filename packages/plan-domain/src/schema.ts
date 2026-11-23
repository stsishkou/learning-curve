// JSON Schemas (draft 2020-12) of the two documents a tool outside the viewer deals with: the plan file it reads
// and the update it gives back. The descriptions are written for a language model: every field says what it means
// and how to fill it. `parseUpdate` is the code that enforces them; change both together.

import { SPLIT_PARTS_MAX } from './changes'

type Schema = Record<string, unknown>

export const PLAN_FORMAT = 'learning-curve/plan@1'
export const UPDATE_FORMAT = 'learning-curve/update@1'

const LOCAL_TIME: Schema = {
  type: 'string',
  pattern: String.raw`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$`,
  description:
    'A wall-clock moment in the plan\'s own time zone (meta.timezone, Europe/Minsk), written "YYYY-MM-DDTHH:MM". No seconds, no "Z", no UTC offset: "2026-11-23T12:00" means noon in Minsk.',
  examples: ['2026-11-23T12:00'],
}

const DAY: Schema = {
  type: 'string',
  pattern: String.raw`^\d{4}-\d{2}-\d{2}$`,
  description: 'A calendar day in the plan\'s time zone, "YYYY-MM-DD".',
  examples: ['2026-11-23'],
}

const COLOR: Schema = {
  type: 'string',
  pattern: '^#[0-9a-fA-F]{6}$',
  description:
    'Color of the calendar as "#rrggbb". Pick one that is easy to tell from the colors of the other calendars and reads on both a light and a dark background.',
  examples: ['#2F5BEA'],
}

const RRULE: Schema = {
  type: 'string',
  pattern: '^FREQ=WEEKLY;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*$',
  description:
    'Makes the event repeat every week on the named days, without an end. Only this form is understood: "FREQ=WEEKLY;BYDAY=" and two-letter days. No UNTIL, COUNT or INTERVAL. `start` and `end` give the first repeat and the time of day of all of them.',
  examples: ['FREQ=WEEKLY;BYDAY=TU,TH'],
}

const TITLE: Schema = {
  type: 'string',
  minLength: 1,
  description:
    'What the calendar shows. A course session is named "<Course short name> — <Module or topic>", with an em dash between spaces, and "(i/n)" at the end when a topic takes n sessions: "GE Agent Dev — ADK: tools (2/3)". A lab is "<Course short name> — Лаба N: <name>". Anything that is not a course session has a plain name: "Спортзал".',
}

const DESCRIPTION: Schema = {
  type: 'string',
  description:
    'Notes of the event. For a course session, three parts on separate lines: "Course: <URL of the course>", "Module: <URL of the module>", then a goal of one to three lines that ends with a line "Done: <how to tell the session is finished>". Leave out a URL line that is not known; never invent a URL. Empty for other events.',
}

const AVAILABILITY: Schema = {
  enum: ['busy', 'free'],
  description:
    '"busy" blocks the time and counts toward the weekly study budget. "free" does neither: use it for optional time, reminders and personal things.',
}

const EVENT: Schema = {
  type: 'object',
  description: 'One event of the plan. Its `uid` is how an update refers to it.',
  required: ['uid', 'calendar', 'title', 'start', 'end', 'kind', 'availability'],
  properties: {
    uid: {
      type: 'string',
      description:
        'Stable id of the event, also its UID in an exported .ics file. Read it from the plan; never make one up. An event generated from the course content looks like "certs-012@learning-curve", one added later like "custom-…@learning-curve".',
    },
    calendar: { type: 'string', description: 'The `id` of the calendar (the course) the event belongs to.' },
    title: TITLE,
    start: LOCAL_TIME,
    end: { ...LOCAL_TIME, description: `${String(LOCAL_TIME.description)} After \`start\`, on the same day.` },
    description: DESCRIPTION,
    kind: {
      enum: ['study', 'lab', 'buffer', 'personal', 'milestone', 'review'],
      description:
        '"study": an ordinary session of a course. "lab": a hands-on session with a timer that cannot be paused, so it is never split. "buffer": spare time to catch up. "personal": not study at all. "milestone": a deadline, usually an all-day event. "review": a short repetition of a finished module.',
    },
    availability: AVAILABILITY,
    allDay: { type: 'boolean', description: 'true for an event that takes a day and has no time, such as a deadline.' },
    rrule: RRULE,
    skip: {
      type: 'array',
      items: DAY,
      description: 'Days on which a repeating event does not happen.',
    },
    done: {
      type: 'boolean',
      description:
        'true once the person has finished the session. Only they know that: an update sets it only when they said so.',
    },
    actual: {
      type: 'integer',
      minimum: 5,
      maximum: 1440,
      description: 'Minutes a done session really took, when that was logged. Without it the planned length counts.',
    },
    paced: {
      type: 'boolean',
      description: 'true when the length of the session was already adjusted to the real pace of its course.',
    },
  },
}

/** Schema of a plan file: what `GET /api/plan` returns, what `Plan file → Download` saves and what a brief holds. */
export const PLAN_SCHEMA: Schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: PLAN_FORMAT,
  title: 'Study plan',
  description:
    'A personal study plan: calendars (one per course, plus personal ones) and dated events in them. It is read-only for a tool: to change the plan, return an update document (see the update schema), never an edited copy of this file. A short copy of the file may leave out `description` of the events.',
  type: 'object',
  required: ['meta', 'calendars', 'events'],
  properties: {
    meta: {
      type: 'object',
      description: 'Facts about the whole plan.',
      required: ['title', 'timezone', 'weeklyBudgetHours', 'planEnd'],
      properties: {
        title: { type: 'string', description: 'Name of the plan.' },
        version: { type: 'integer', description: 'Version of the file layout.' },
        timezone: {
          type: 'string',
          description:
            'IANA time zone every time in the file is written in. All times are wall-clock strings in this zone.',
        },
        generated: { ...DAY, description: 'Day the schedule was last generated.' },
        weeklyBudgetHours: {
          type: 'number',
          description:
            'Most hours of study a week (Monday to Sunday) may hold. Busy, timed, non-repeating events count; free time and repeats such as the gym do not. An update must not push a week over it unless the person asked for that.',
        },
        holidays: {
          type: 'array',
          items: DAY,
          description: 'Days without study: never put a session on one.',
        },
        planEnd: { ...DAY, description: 'Day of the last event.' },
      },
    },
    calendars: {
      type: 'array',
      description:
        'The calendars. Each course has its own; "personal" holds what is not study. Events are exported into calendars of the same names.',
      items: {
        type: 'object',
        required: ['id', 'name', 'color'],
        properties: {
          id: { type: 'string', description: 'Id an event names in its `calendar` field.' },
          name: { type: 'string', description: 'Name of the course or of the calendar, as people see it.' },
          color: COLOR,
          isNew: {
            type: 'boolean',
            description: "true when the calendar does not exist in the person's calendar app yet.",
          },
          note: { type: 'string', description: 'What the calendar is for.' },
          custom: { type: 'boolean', description: 'true for a calendar added after the schedule was generated.' },
        },
      },
    },
    events: {
      type: 'array',
      description: 'Every event, sorted by start.',
      items: EVENT,
    },
  },
}

const NEW_SESSION_PROPERTIES: Schema = {
  title: TITLE,
  start: LOCAL_TIME,
  end: { ...LOCAL_TIME, description: 'When it ends: after `start`, on the same day. Sessions are 1 or 2 hours.' },
  description: DESCRIPTION,
  availability: { ...AVAILABILITY, default: 'busy' },
  kind: {
    enum: ['study', 'lab'],
    default: 'study',
    description:
      '"lab" for a hands-on session that cannot be paused: give it one whole block. Leave out for an ordinary session.',
  },
  rrule: {
    ...RRULE,
    description: `${String(RRULE.description)} \`start\` must fall on one of the named days. Only for a habit or a standing appointment (gym, a weekly call): a course session is never a repeat, because a repeat cannot be marked done. Give each session its own event.`,
  },
}

const NEW_SESSION: Schema = {
  type: 'object',
  description: 'A session of the course that is being added. Its calendar is the new course.',
  required: ['title', 'start', 'end'],
  additionalProperties: false,
  properties: NEW_SESSION_PROPERTIES,
}

const NEW_EVENT: Schema = {
  type: 'object',
  description: 'An event to add. It gets its `uid` when the update is applied, so the same update cannot refer to it.',
  required: ['calendar', 'title', 'start', 'end'],
  additionalProperties: false,
  properties: {
    calendar: { type: 'string', description: 'The `id` of a calendar that is in the plan.' },
    ...NEW_SESSION_PROPERTIES,
  },
}

const UID: Schema = { type: 'string', description: 'The `uid` of an event that is in the plan.' }

const change = (type: string, description: string, properties: Schema, required: string[] = []): Schema => ({
  type: 'object',
  description,
  required: ['type', ...required],
  additionalProperties: false,
  properties: { type: { const: type }, ...properties },
})

/** The change needs at least one of `keys`. */
const withOneOf = (keys: string[], schema: Schema): Schema => ({
  ...schema,
  anyOf: keys.map((key) => ({ required: [key] })),
})

const CHANGES: Schema[] = [
  change(
    'course.add',
    'Adds a new course: a calendar with this name and color and all its sessions, as one step the person can undo. Use it once per new course. For a course whose calendar is already in the plan use "events.add".',
    {
      name: { type: 'string', minLength: 1, description: 'Name of the course as the calendar shows it.' },
      color: COLOR,
      sessions: { type: 'array', minItems: 1, maxItems: 400, items: NEW_SESSION },
    },
    ['name', 'color', 'sessions'],
  ),
  change(
    'events.add',
    'Adds several events to calendars that are in the plan, as one step: more sessions of a course, or a repeating habit.',
    { events: { type: 'array', minItems: 1, maxItems: 400, items: NEW_EVENT } },
    ['events'],
  ),
  change('event.add', 'Adds one event.', { event: NEW_EVENT }, ['event']),
  change(
    'event.patch',
    'Changes fields of one event. Only the fields that are named change.',
    {
      uid: UID,
      patch: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          title: TITLE,
          description: DESCRIPTION,
          start: LOCAL_TIME,
          end: LOCAL_TIME,
          calendar: { type: 'string', description: 'Moves the event to another calendar: its `id`.' },
          done: {
            type: 'boolean',
            description: 'Marks a session finished or not. Only when the person said so.',
          },
          actual: {
            type: 'integer',
            minimum: 5,
            maximum: 1440,
            description: 'Minutes a done session really took.',
          },
          rrule: {
            ...RRULE,
            description:
              'New days for an event that already repeats. An event that does not repeat cannot be turned into a repeat: remove it and add a repeating one.',
          },
          skip: {
            type: 'array',
            items: DAY,
            description:
              'The full list of days a repeating event does not happen on. It replaces the list in the plan.',
          },
        },
      },
    },
    ['uid', 'patch'],
  ),
  change(
    'event.detach',
    'Moves one repeat of a repeating event and leaves the others: the repeat on `day` is skipped and an event of its own runs from `start` to `end`.',
    { uid: UID, day: DAY, start: LOCAL_TIME, end: LOCAL_TIME },
    ['uid', 'day', 'start', 'end'],
  ),
  change(
    'event.split',
    'Splits one session into parts, as one step: the first part keeps the event and its `uid`, the others are new events with the same title and notes. The parts must add up to the length of the session, each on one day. A lab, a repeat or a finished session cannot be split.',
    {
      uid: UID,
      parts: {
        type: 'array',
        minItems: 2,
        maxItems: SPLIT_PARTS_MAX,
        items: {
          type: 'object',
          required: ['start', 'end'],
          additionalProperties: false,
          properties: { start: LOCAL_TIME, end: LOCAL_TIME },
        },
      },
    },
    ['uid', 'parts'],
  ),
  change(
    'event.remove',
    'Moves an event to the trash, a whole series when it repeats. The person can restore it for 30 days.',
    { uid: UID },
    ['uid'],
  ),
  change(
    'events.move',
    'Puts several sessions into new slots as one step: the way to rearrange a week or to catch up.',
    {
      moves: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['uid', 'start', 'end'],
          additionalProperties: false,
          properties: { uid: UID, start: LOCAL_TIME, end: LOCAL_TIME },
        },
      },
      reason: {
        enum: ['rebalance'],
        description: 'Only when the moves are the re-balance of one calendar, given with that `calendar`.',
      },
      calendar: { type: 'string', description: 'The `id` of the calendar that was re-balanced.' },
    },
    ['moves'],
  ),
  withOneOf(
    ['days', 'hours'],
    change(
      'events.shift',
      'Moves every session that is not done and starts on `from` or later by whole days, by whole or half hours, or both, in one calendar or in all: the way to make room after time off, or to study later in the day. It does not skip weekends or holidays: check where the sessions land. A session that would cross midnight stops the change.',
      {
        from: DAY,
        days: {
          type: 'integer',
          minimum: -366,
          maximum: 366,
          description: 'Days to move by; negative moves earlier.',
        },
        hours: {
          type: 'number',
          multipleOf: 0.5,
          minimum: -23.5,
          maximum: 23.5,
          description: 'Hours to move by, whole or half; negative moves earlier. Give `days`, `hours` or both, not 0.',
        },
        calendar: { type: 'string', description: 'The `id` of the only calendar to shift. Leave out to shift all.' },
      },
      ['from'],
    ),
  ),
  change(
    'events.done',
    'Marks several sessions finished or not finished, as one step. Only for sessions the person named.',
    { uids: { type: 'array', minItems: 1, items: UID }, done: { type: 'boolean' } },
    ['uids', 'done'],
  ),
  change(
    'calendar.save',
    'Renames or recolors a calendar that is in the plan. (Without `id` it creates an empty calendar; to add a course use "course.add".)',
    {
      id: { type: 'string', description: 'The `id` of the calendar.' },
      name: { type: 'string', minLength: 1 },
      color: COLOR,
    },
    ['name', 'color'],
  ),
  change('plan.rename', 'Gives the plan another name.', { title: { type: 'string', minLength: 1, maxLength: 80 } }, [
    'title',
  ]),
]

/** The `type` of every change an update may carry. Emptying the trash and removing calendars stay with the person. */
export const UPDATE_CHANGE_TYPES = [
  'course.add',
  'events.add',
  'event.add',
  'event.patch',
  'event.detach',
  'event.split',
  'event.remove',
  'events.move',
  'events.shift',
  'events.done',
  'calendar.save',
  'plan.rename',
] as const

/** Schema of an update: what a chat or a tool returns to change the plan. Also the input of the MCP tools. */
export const UPDATE_SCHEMA: Schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: UPDATE_FORMAT,
  title: 'Study plan update',
  description:
    "A list of changes to a study plan. The changes are applied in order, each as one step of the plan's history that the person can undo. The whole update is checked first: when one change does not fit the plan, none is applied.",
  type: 'object',
  required: ['changes'],
  additionalProperties: false,
  properties: {
    format: { const: UPDATE_FORMAT, description: 'Names this document. Always this value.' },
    summary: {
      type: 'string',
      description:
        'One or two sentences for the person, in their language: what the update does and anything they should check, such as a week that is now full.',
    },
    changes: {
      type: 'array',
      minItems: 1,
      maxItems: 200,
      description: 'The changes, in the order they are applied.',
      items: { oneOf: CHANGES },
    },
  },
}
