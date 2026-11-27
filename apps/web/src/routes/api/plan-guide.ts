import { readPlan } from '@lc/plan-data'
import { nowMinsk } from '@lc/plan-domain'
import { planBrief, planGuide } from '@lc/plan-domain/protocol'
import { createFileRoute } from '@tanstack/react-router'

/**
 * GET /api/plan-guide — the instructions a chat or a tool needs to change the plan, as Markdown. With `?brief=1`
 * the plan follows the guide in the same text (`&descriptions=1` keeps the notes of the events).
 */
export const Route = createFileRoute('/api/plan-guide')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const query = new URL(request.url).searchParams
        const plan = readPlan()
        const text = query.has('brief')
          ? planBrief(plan, nowMinsk(), { descriptions: query.has('descriptions') })
          : planGuide(plan, nowMinsk())
        return new Response(text, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' },
        })
      },
    },
  },
})
