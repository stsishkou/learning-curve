import { isCalendarProvider } from '@lc/plan-domain'
import { failureMessage } from '@lc/plan-service'
import { createFileRoute } from '@tanstack/react-router'

import { actorOf } from '#/server/actor'
import { publicUrl } from '#/server/public-url'
import { statusOf } from '#/server/respond'
import { services } from '#/server/services'

/**
 * GET /api/<provider>/connect — sends the browser to the calendar app's sign-in, which comes back to
 * `/api/<provider>/callback` on the address the planner was opened at: the redirect URI the planner asks to register
 * on the person's own client.
 */
export const Route = createFileRoute('/api/$provider/connect')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { provider } = params
        if (!isCalendarProvider(provider)) return new Response('Unknown calendar app', { status: 404 })
        const callback = publicUrl(`/api/${provider}/callback`, request)
        try {
          const address = await services.calendars.connectAddress(actorOf(), provider, callback)
          if (!address.ok) return new Response(failureMessage(address.error), { status: statusOf(address.error) })
          return Response.redirect(address.value, 302)
        } catch {
          // It rejects when no client is known for the app: the planner then says the sign-in failed.
          return Response.redirect(publicUrl(`/?link=${provider}&signin=failed`, request), 302)
        }
      },
    },
  },
})
