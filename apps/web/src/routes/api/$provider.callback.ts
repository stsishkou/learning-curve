import { CalendarAuthError, finishConnect, syncCalendar } from '@lc/plan-data'
import { isCalendarProvider } from '@lc/plan-domain'
import { createFileRoute } from '@tanstack/react-router'

/** How a sign-in ended, as the planner explains it. */
function outcome(error: unknown): 'scope' | 'client' | 'failed' {
  if (error instanceof CalendarAuthError && (error.reason === 'scope' || error.reason === 'client')) return error.reason
  return 'failed'
}

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
        let ended = url.searchParams.get('error') === 'access_denied' ? 'denied' : 'failed'
        if (code) {
          try {
            await finishConnect(provider, code, state)
            void syncCalendar(provider)
            ended = 'connected'
          } catch (err) {
            ended = outcome(err)
          }
        }
        return Response.redirect(new URL(`/?link=${provider}&signin=${ended}`, request.url).href, 302)
      },
    },
  },
})
