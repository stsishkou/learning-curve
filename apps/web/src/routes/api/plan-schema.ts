import { PLAN_SCHEMA, UPDATE_SCHEMA } from '@lc/plan-domain'
import { createFileRoute } from '@tanstack/react-router'

/** GET /api/plan-schema — the JSON Schemas of the plan file (`plan`) and of an update to it (`update`). */
export const Route = createFileRoute('/api/plan-schema')({
  server: {
    handlers: {
      GET: () => Response.json({ plan: PLAN_SCHEMA, update: UPDATE_SCHEMA }),
    },
  },
})
