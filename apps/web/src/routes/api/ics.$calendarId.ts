import { feedRevisions, readPlan } from '@lc/plan-data'
import { calendarICS, combinedCalendar, combinedICS, icsETag, icsFileName } from '@lc/plan-domain/ics'
import { createFileRoute } from '@tanstack/react-router'

/**
 * GET /api/ics/:calendarId — one calendar as .ics (`certs`, `hfllm`, … or `certs.ics`);
 * `all` returns every calendar's events in one file.
 * Add `?download=1` to get it as an attachment, `?done=1` to mark finished sessions with ✓ and free their time,
 * `?alarm=10` to ask for a reminder that many minutes before each start. Once the app is deployed on a public URL,
 * this address can be added in Google Calendar / Outlook as a subscription ("From URL"). Each event carries its
 * version (`SEQUENCE`, `LAST-MODIFIED`), and a client that sends back the `ETag` gets `304` while nothing changed.
 */
const matches = (header: string | null, etag: string) =>
  header !== null &&
  (header.trim() === '*' ||
    header.split(',').some((tag) => tag.trim().replace(/^W\//, '') === etag.replace(/^W\//, '')))

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
        const query = new URL(request.url).searchParams
        // `?alarm=10`: minutes; anything that is not 1 to 1440 leaves the alarms out.
        const alarm = Number(query.get('alarm'))
        const options = {
          markDone: query.has('done'),
          alarm: Number.isInteger(alarm) && alarm > 0 && alarm <= 1440 ? alarm : undefined,
          source: request.url,
          revisions: feedRevisions(plan),
        }
        const body =
          id === 'all'
            ? combinedICS(plan, new Set(only ?? plan.calendars.map((c) => c.id)), options)
            : calendarICS(plan, calendar, options)
        const download = query.has('download')
        const etag = icsETag(body)
        // Stored but checked every time: a polling client asks again and gets 304 while nothing changed.
        const cache = { ETag: etag, 'Cache-Control': 'no-cache' }
        if (matches(request.headers.get('If-None-Match'), etag))
          return new Response(null, { status: 304, headers: cache })
        return new Response(body, {
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            ...cache,
            ...(download
              ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(icsFileName(calendar))}` }
              : {}),
          },
        })
      },
    },
  },
})
