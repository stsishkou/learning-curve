import { canWrite, connectAddress } from '@lc/plan-data'
import { isCalendarProvider } from '@lc/plan-domain'
import { createFileRoute } from '@tanstack/react-router'

/**
 * GET /api/<provider>/connect — sends the browser to the calendar app's sign-in, which comes back to
 * `/api/<provider>/callback` on the address the planner was opened at: the redirect URI the planner asks to register
 * on the person's own client.
 */
export const Route = createFileRoute('/api/$provider/connect')({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        const { provider } = params
        if (!isCalendarProvider(provider)) return new Response('Unknown calendar app', { status: 404 })
        if (!canWrite()) return new Response('The plan is read-only here', { status: 403 })
        const callback = new URL(`/api/${provider}/callback`, request.url).href
        try {
          return Response.redirect(connectAddress(provider, callback), 302)
        } catch {
          return Response.redirect(new URL(`/?${provider}=failed`, request.url).href, 302)
        }
      },
    },
  },
})
