import { canWrite, connectAddress } from '@lc/plan-data'
import { createFileRoute } from '@tanstack/react-router'

/**
 * GET /api/google/connect — sends the browser to Google's sign-in, which comes back to `/api/google/callback` on the
 * address the planner was opened at: the redirect URI the planner asks to register on the Web application client.
 */
export const Route = createFileRoute('/api/google/connect')({
  server: {
    handlers: {
      GET: ({ request }) => {
        if (!canWrite()) return new Response('The plan is read-only here', { status: 403 })
        const callback = new URL('/api/google/callback', request.url).href
        try {
          return Response.redirect(connectAddress(callback), 302)
        } catch {
          return Response.redirect(new URL('/?google=failed', request.url).href, 302)
        }
      },
    },
  },
})
