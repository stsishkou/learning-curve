import { finishConnect, syncGoogle } from '@lc/plan-data'
import { createFileRoute } from '@tanstack/react-router'

/** GET /api/google/callback — where Google's sign-in comes back; the planner then opens on the Google dialog. */
export const Route = createFileRoute('/api/google/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state') ?? ''
        let outcome = 'failed'
        if (code) {
          try {
            await finishConnect(code, state)
            void syncGoogle()
            outcome = 'connected'
          } catch {
            // The planner says it did not work; the reason is in the server log of the token call, if anywhere.
          }
        }
        return Response.redirect(new URL(`/?google=${outcome}`, request.url).href, 302)
      },
    },
  },
})
