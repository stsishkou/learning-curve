import { nowMinsk } from '@lc/plan-domain'
import { accuracyReport } from '@lc/plan-domain/insights'
import { createFileRoute } from '@tanstack/react-router'

import { actorOf } from '#/server/actor'
import { respond } from '#/server/respond'
import { services } from '#/server/services'

/**
 * GET /api/plan-accuracy — how the logged times compare with the plan, per course and kind of session, with each
 * course's finish range. `?calendar=<id>` keeps one course.
 */
export const Route = createFileRoute('/api/plan-accuracy')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const calendar = new URL(request.url).searchParams.get('calendar') ?? undefined
        return respond(await services.plans.read(actorOf()), (plan) =>
          Response.json(accuracyReport(plan, nowMinsk(), calendar), { headers: { 'Cache-Control': 'no-store' } }),
        )
      },
    },
  },
})
