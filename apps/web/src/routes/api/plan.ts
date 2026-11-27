import { createFileRoute } from '@tanstack/react-router'

import { actorOf } from '#/server/actor'
import { respond } from '#/server/respond'
import { services } from '#/server/services'

/** GET /api/plan — the plan database as JSON. */
export const Route = createFileRoute('/api/plan')({
  server: {
    handlers: {
      GET: async () =>
        respond(await services.plans.read(actorOf()), (plan) =>
          Response.json(plan, { headers: { 'Cache-Control': 'no-store' } }),
        ),
    },
  },
})
