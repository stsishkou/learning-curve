import { GoogleAuthError, finishConnect, syncGoogle } from '@lc/plan-data'
import { createFileRoute } from '@tanstack/react-router'

/** How a sign-in ended, as the planner's Google dialog explains it. */
function outcome(error: unknown): 'scope' | 'client' | 'failed' {
  if (error instanceof GoogleAuthError && (error.reason === 'scope' || error.reason === 'client')) return error.reason
  return 'failed'
}

/** GET /api/google/callback — where Google's sign-in comes back; the planner then opens on the Google dialog. */
export const Route = createFileRoute('/api/google/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state') ?? ''
        // Google comes back with `error=access_denied` when the person cancels on its page.
        let ended = url.searchParams.get('error') === 'access_denied' ? 'denied' : 'failed'
        if (code) {
          try {
            await finishConnect(code, state)
            void syncGoogle()
            ended = 'connected'
          } catch (err) {
            ended = outcome(err)
          }
        }
        return Response.redirect(new URL(`/?google=${ended}`, request.url).href, 302)
      },
    },
  },
})
