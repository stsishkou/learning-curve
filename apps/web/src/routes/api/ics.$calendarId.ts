import { readPlan } from '@lc/plan-data'
import { calendarICS, combinedCalendar, combinedICS, icsFileName } from '@lc/plan-domain'
import { createFileRoute } from '@tanstack/react-router'

/**
 * GET /api/ics/:calendarId — one calendar as .ics (`certs`, `hfllm`, … or `certs.ics`);
 * `all` returns every calendar's events in one file.
 * Add `?download=1` to get it as an attachment. Once the app is deployed on a public URL,
 * this address can be added in Google Calendar / Outlook as a subscription ("From URL").
 */
export const Route = createFileRoute('/api/ics/$calendarId')({
  server: {
    handlers: {
      GET: ({ params, request }) => {
        const plan = readPlan()
        const id = params.calendarId.replace(/\.ics$/, '')
        // `all` is the combined calendar; `?calendars=certs,hfllm` narrows it.
        const only = new URL(request.url).searchParams.get('calendars')?.split(',')
        const calendar = id === 'all' ? combinedCalendar(plan) : plan.calendars.find((c) => c.id === id)
        if (!calendar)
          return new Response(`Unknown calendar "${id}". Known: all, ${plan.calendars.map((c) => c.id).join(', ')}`, {
            status: 404,
          })
        const body =
          id === 'all'
            ? combinedICS(plan, new Set(only ?? plan.calendars.map((c) => c.id)))
            : calendarICS(plan, calendar)
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
