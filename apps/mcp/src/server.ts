import { nowMinsk, type Plan } from '@lc/plan-domain'
import { accuracyReport } from '@lc/plan-domain/insights'
import {
  PLAN_SCHEMA,
  UPDATE_SCHEMA,
  compactPlan,
  parseUpdate,
  planBrief,
  planGuide,
  reportPreview,
  updateOutcome,
} from '@lc/plan-domain/protocol'
import { rebalanceChange } from '@lc/plan-domain/rebalance'
import { failureMessage, type Actor, type PlanFailure, type PlanServices, type Result } from '@lc/plan-service'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { requestFromTool } from './rebalance-args'
import { PROMPT, RESOURCES, TOOLS } from './tools'

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

/** The value of a call on the plan; its failure is thrown, for the handler to answer as a tool error. */
function unwrap<T>(result: Result<T, PlanFailure>): T {
  if (!result.ok) throw new Error(failureMessage(result.error))
  return result.value
}

/**
 * A Model Context Protocol server for the plan: an assistant reads the plan and its guide, previews an update and
 * applies it. Each tool is one call on `services` made for `actor`; the documents and their rules come from
 * `@lc/plan-domain`. Connect it to a transport to serve it.
 */
// oxlint-disable-next-line typescript/no-deprecated -- the tools are raw JSON Schema, which only Server takes
export function createMcpServer(services: PlanServices, actor: Actor): Server {
  // oxlint-disable-next-line typescript/no-deprecated -- McpServer takes Zod shapes; the tools here are raw JSON Schema
  const server = new Server(
    { name: 'learning-curve', title: 'Study plan', version: '1.0.0' },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions:
        'A personal study plan. Call get_guide first: it holds the rules of the plan and the format of an update. Read events with get_plan, check a change with preview_update, show the result to the person and store it with apply_update only when they agree.',
    },
  )

  const readPlan = async (): Promise<Plan> => unwrap(await services.plans.read(actor))

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }))

  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    const args = params.arguments ?? {}
    try {
      const plan = await readPlan()
      switch (params.name) {
        case 'get_guide':
          return text(planGuide(plan, nowMinsk()))
        case 'get_plan':
          return json(narrowed(plan, args))
        case 'get_accuracy':
          return json(accuracyReport(plan, nowMinsk(), typeof args.calendar === 'string' ? args.calendar : undefined))
        case 'preview_update': {
          const update = parseUpdate(args)
          return json(reportPreview(unwrap(await services.plans.preview(actor, update.changes))))
        }
        case 'apply_update': {
          const update = parseUpdate(args)
          const report = reportPreview(unwrap(await services.plans.preview(actor, update.changes)))
          if (!report.ok) return { ...json(report), isError: true }
          // Read from what was stored: the ids of new events and calendars are given out only then.
          const stored = unwrap(await services.plans.apply(actor, update.changes))
          return json({ ...reportPreview(updateOutcome(plan, stored.plan)), applied: update.changes.length })
        }
        case 'rebalance_calendar': {
          const request = requestFromTool(args, plan)
          const result = unwrap(await services.rebalance.rebalance(actor, plan, request))
          const change = rebalanceChange(result, request.calendar)
          return json({ update: change ? { changes: [change] } : null, report: result.report })
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

  server.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => {
    const known = RESOURCES.find((r) => r.uri === params.uri)
    if (!known) throw new Error(`Unknown resource "${params.uri}"`)
    const plan = await readPlan()
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

  server.setRequestHandler(ListPromptsRequestSchema, () => ({ prompts: [PROMPT] }))

  server.setRequestHandler(GetPromptRequestSchema, async ({ params }) => {
    if (params.name !== PROMPT.name) throw new Error(`Unknown prompt "${params.name}"`)
    const brief = planBrief(await readPlan(), nowMinsk(), { request: params.arguments?.request })
    return {
      description: PROMPT.description,
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text: brief } }],
    }
  })

  return server
}
