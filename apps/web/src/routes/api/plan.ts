import { readPlan } from '@lc/plan-data'
import { createFileRoute } from '@tanstack/react-router'

/** GET /api/plan — the plan database as JSON. */
export const Route = createFileRoute('/api/plan')({
  server: {
    handlers: {
      GET: () => Response.json(readPlan(), { headers: { 'Cache-Control': 'no-store' } }),
    },
  },
})
