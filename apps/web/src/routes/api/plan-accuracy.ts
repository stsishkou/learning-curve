import { readPlan } from '@lc/plan-data'
import { nowMinsk } from '@lc/plan-domain'
import { accuracyReport } from '@lc/plan-domain/insights'
import { createFileRoute } from '@tanstack/react-router'

/**
 * GET /api/plan-accuracy — how the logged times compare with the plan, per course and kind of session, with each
 * course's finish range. `?calendar=<id>` keeps one course.
 */
export const Route = createFileRoute('/api/plan-accuracy')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const calendar = new URL(request.url).searchParams.get('calendar') ?? undefined
        return Response.json(accuracyReport(readPlan(), nowMinsk(), calendar), {
          headers: { 'Cache-Control': 'no-store' },
        })
      },
    },
  },
})
