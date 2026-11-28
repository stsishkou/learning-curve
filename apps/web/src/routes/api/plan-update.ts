import type { PlanChange } from '@lc/plan-domain'
import { parseUpdate, reportPreview, updateOutcome } from '@lc/plan-domain/protocol'
import { createFileRoute } from '@tanstack/react-router'

import { actorOf } from '#/server/actor'
import { failed, respond } from '#/server/respond'
import { services } from '#/server/services'

const unreadable = (err: unknown) =>
  Response.json({ ok: false, problem: { message: err instanceof Error ? err.message : String(err) } }, { status: 422 })

/**
 * POST /api/plan-update — takes an update (see `/api/plan-schema`) as JSON, or as the text of a chat answer that
 * holds one. With `?dry=1` it only reports what the update would do. Otherwise it stores it, all or nothing:
 * 422 with the change at fault when it does not fit, 403 on a read-only host.
 */
export const Route = createFileRoute('/api/plan-update')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const dry = new URL(request.url).searchParams.has('dry')
        let changes: PlanChange[]
        try {
          changes = parseUpdate(await request.text()).changes
        } catch (err) {
          return unreadable(err)
        }
        const actor = actorOf()
        // The stored outcome is told against the plan as it was, as the preview is.
        const before = await services.plans.read(actor)
        if (!before.ok) return failed(before.error)
        const preview = await services.plans.preview(actor, changes)
        if (!preview.ok) return failed(preview.error)
        const report = reportPreview(preview.value)
        if (!report.ok) return Response.json(report, { status: 422 })
        if (dry) return Response.json(report)
        return respond(await services.plans.apply(actor, changes), (view) =>
          Response.json({ ...reportPreview(updateOutcome(before.value, view.plan)), applied: changes.length }),
        )
      },
    },
  },
})
