import { createFileRoute } from '@tanstack/react-router'

import { bundledPlan as plan } from '#/lib/plan/bundled'
import { buildICS, icsFileName } from '#/lib/plan/ics'

/**
 * GET /api/ics/:calendarId — one calendar as .ics (`certs`, `hfllm`, … or `certs.ics`).
 * Add `?download=1` to get it as an attachment. Once the app is deployed on a public URL,
 * this address can be added in Google Calendar / Outlook as a subscription ("From URL").
 */
export const Route = createFileRoute('/api/ics/$calendarId')({
  server: {
    handlers: {
      GET: ({ params, request }) => {
        const id = params.calendarId.replace(/\.ics$/, '')
        const calendar = plan.calendars.find((c) => c.id === id)
        if (!calendar)
          return new Response(`Unknown calendar "${id}". Known: ${plan.calendars.map((c) => c.id).join(', ')}`, {
            status: 404,
          })
        const body = buildICS(
          calendar,
          plan.events.filter((e) => e.calendar === id),
          plan.meta.timezone,
        )
        const download = new URL(request.url).searchParams.has('download')
        return new Response(body, {
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Cache-Control': 'no-store',
            ...(download
              ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(icsFileName(calendar))}` }
              : {}),
          },
        })
      },
    },
  },
})
