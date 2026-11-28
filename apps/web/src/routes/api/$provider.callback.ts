import { isCalendarProvider } from '@lc/plan-domain'
import type { CalendarSignInFailure } from '@lc/plan-service'
import { createFileRoute } from '@tanstack/react-router'

import { actorOf } from '#/server/actor'
import { publicUrl } from '#/server/public-url'
import { services } from '#/server/services'

/** GET /api/<provider>/callback — where a calendar app's sign-in comes back; the planner then says how it went. */
export const Route = createFileRoute('/api/$provider/callback')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { provider } = params
        if (!isCalendarProvider(provider)) return new Response('Unknown calendar app', { status: 404 })
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state') ?? ''
        // Both apps come back with `error=access_denied` when the person cancels on their page.
        let ended: CalendarSignInFailure | 'connected' =
          url.searchParams.get('error') === 'access_denied' ? 'denied' : 'failed'
        if (code) {
          const finished = await services.calendars.finishConnect(actorOf(), provider, code, state)
          ended = finished.ok ? 'connected' : finished.error
        }
        return Response.redirect(publicUrl(`/?link=${provider}&signin=${ended}`, request), 302)
      },
    },
  },
})
