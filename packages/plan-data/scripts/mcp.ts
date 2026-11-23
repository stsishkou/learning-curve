// A Model Context Protocol server for the plan, over stdio: an assistant reads the plan and its guide, previews
// an update and applies it. It is a thin adapter: the documents and their rules come from @lc/plan-domain.
//   pnpm --silent run mcp     (stdout carries the protocol, so nothing else may print there)
import {
  PLAN_SCHEMA,
  UPDATE_SCHEMA,
  compactPlan,
  nowMinsk,
  parseUpdate,
  planBrief,
  planGuide,
  previewUpdate,
  reportPreview,
  updateOutcome,
  type Plan,
} from '@lc/plan-domain'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { rebalanceCalendar, requestFromTool } from '../src/rebalance'
import { canWrite, readPlan, saveChanges } from '../src/store'

const DAY = String.raw`^\d{4}-\d{2}-\d{2}$`
const HOUR = String.raw`^([01]\d|2[0-3]):(00|30)$`

const TOOLS = [
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
      'Works out new days and times for the sessions of one calendar from a day on, keeping the order of the course: evenly at a pace (sessions a study day), or towards a deadline (the calendar\'s milestone unless one is given), inside the study hours and the weekly budget, around holidays, other events and the person\'s busy time. Nothing is stored. The answer is an `update` (an events.move with reason "rebalance", or null when nothing moves) to check with preview_update and store with apply_update once the person agrees, and a `report`: the finish, the heaviest week and day, weeks over the budget, late and unplaced sessions, and the reasons nothing better exists. It can take several seconds.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['calendar', 'from', 'mode'],
      properties: {
        calendar: { type: 'string', description: 'The `id` of the calendar to re-balance.' },
        from: { type: 'string', pattern: DAY, description: 'Its sessions from this day on move, "YYYY-MM-DD".' },
        mode: {
          type: 'string',
          enum: ['pace', 'deadline'],
          description: '`pace`: a steady number of sessions a study day. `deadline`: done before the deadline, evenly.',
        },
        perDay: {
          type: 'number',
          exclusiveMinimum: 0,
          description: 'Sessions a study day, for `pace`: 1/3, 1/2, 1, 3/2, 2 or 3 (0.5 is one every two days).',
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

const RESOURCES = [
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

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] })
const json = (value: unknown) => text(JSON.stringify(value, null, 2))
const refused = (message: string) => ({ ...text(message), isError: true })

const day = (value: unknown) => (typeof value === 'string' ? value : '')

function narrowed(plan: Plan, args: Record<string, unknown>): Plan {
  const [from, to] = [day(args.from), day(args.to)]
  const shown = compactPlan(plan, args.descriptions === true)
  return {
    ...shown,
    events: shown.events.filter(
      (e) =>
        (typeof args.calendar !== 'string' || e.calendar === args.calendar) &&
        (!from || e.start.slice(0, 10) >= from) &&
        (!to || e.start.slice(0, 10) <= to),
    ),
  }
}

// oxlint-disable-next-line typescript/no-deprecated -- McpServer takes Zod shapes; the tools here are raw JSON Schema
const server = new Server(
  { name: 'learning-curve', title: 'Study plan', version: '1.0.0' },
  {
    capabilities: { tools: {}, resources: {}, prompts: {} },
    instructions:
      'A personal study plan. Call get_guide first: it holds the rules of the plan and the format of an update. Read events with get_plan, check a change with preview_update, show the result to the person and store it with apply_update only when they agree.',
  },
)

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  const args = params.arguments ?? {}
  const plan = readPlan()
  try {
    switch (params.name) {
      case 'get_guide':
        return text(planGuide(plan, nowMinsk()))
      case 'get_plan':
        return json(narrowed(plan, args))
      case 'preview_update': {
        const update = parseUpdate(args)
        return json(reportPreview(previewUpdate(plan, update.changes)))
      }
      case 'apply_update': {
        if (!canWrite()) return refused('The plan is read-only here.')
        const update = parseUpdate(args)
        const report = reportPreview(previewUpdate(plan, update.changes))
        if (!report.ok) return { ...json(report), isError: true }
        // Read from what was stored: the ids of new events and calendars are given out only then.
        const stored = updateOutcome(plan, saveChanges(update.changes).plan)
        return json({ ...reportPreview(stored), applied: update.changes.length })
      }
      case 'rebalance_calendar': {
        const request = requestFromTool(args, plan)
        const { moves, report } = await rebalanceCalendar(plan, request, nowMinsk())
        const changes = [{ type: 'events.move', moves, reason: 'rebalance', calendar: request.calendar }]
        return json({ update: moves.length ? { changes } : null, report })
      }
      default:
        return refused(`Unknown tool "${params.name}"`)
    }
  } catch (err) {
    // A message the model can act on: which change is wrong and why.
    return refused(err instanceof Error ? err.message : String(err))
  }
})

server.setRequestHandler(ListResourcesRequestSchema, () => ({ resources: RESOURCES }))

server.setRequestHandler(ReadResourceRequestSchema, ({ params }) => {
  const known = RESOURCES.find((r) => r.uri === params.uri)
  if (!known) throw new Error(`Unknown resource "${params.uri}"`)
  const plan = readPlan()
  const bodies: Record<string, () => string> = {
    'plan://guide': () => planGuide(plan, nowMinsk()),
    'plan://plan': () => JSON.stringify(plan, null, 2),
    'plan://schema/plan': () => JSON.stringify(PLAN_SCHEMA, null, 2),
    'plan://schema/update': () => JSON.stringify(UPDATE_SCHEMA, null, 2),
  }
  const body = bodies[known.uri]
  if (!body) throw new Error(`No text for resource "${known.uri}"`)
  return { contents: [{ uri: known.uri, mimeType: known.mimeType, text: body() }] }
})

const PROMPT = {
  name: 'change_plan',
  title: 'Change the study plan',
  description: 'The guide and the plan in one message, with what you want to change.',
  arguments: [{ name: 'request', description: 'What to change, in your own words', required: false }],
}

server.setRequestHandler(ListPromptsRequestSchema, () => ({ prompts: [PROMPT] }))

server.setRequestHandler(GetPromptRequestSchema, ({ params }) => {
  if (params.name !== PROMPT.name) throw new Error(`Unknown prompt "${params.name}"`)
  const brief = planBrief(readPlan(), nowMinsk(), { request: params.arguments?.request })
  return {
    description: PROMPT.description,
    messages: [{ role: 'user' as const, content: { type: 'text' as const, text: brief } }],
  }
})

await server.connect(new StdioServerTransport())
