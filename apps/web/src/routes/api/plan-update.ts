import { canWrite, readPlan, saveChanges } from '@lc/plan-data'
import { parseUpdate, previewUpdate, reportPreview, updateOutcome } from '@lc/plan-domain'
import { createFileRoute } from '@tanstack/react-router'

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
        const plan = readPlan()
        try {
          const { changes } = parseUpdate(await request.text())
          const report = reportPreview(previewUpdate(plan, changes))
          if (!report.ok) return Response.json(report, { status: 422 })
          if (dry) return Response.json(report)
          if (!canWrite())
            return Response.json({ ok: false, problem: { message: 'The plan is read-only here' } }, { status: 403 })
          const stored = updateOutcome(plan, saveChanges(changes).plan)
          return Response.json({ ...reportPreview(stored), applied: changes.length })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return Response.json({ ok: false, problem: { message } }, { status: 422 })
        }
      },
    },
  },
})
