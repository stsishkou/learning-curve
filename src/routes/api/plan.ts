import { createFileRoute } from '@tanstack/react-router'

import planData from '#/data/plan.json'

/** GET /api/plan — the plan database as JSON. */
export const Route = createFileRoute('/api/plan')({
  server: {
    handlers: {
      GET: () => Response.json(planData, { headers: { 'Cache-Control': 'no-store' } }),
    },
  },
})
