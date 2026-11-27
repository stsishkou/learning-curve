import { m } from '@lc/i18n/messages'
import { FocusPage, parseFocusSearch } from '@lc/planner'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { getPlanView, savePlanChange } from '#/server/plan'

/** The focus page of the planner module at `/focus`: one session and a stopwatch that logs the time it took. */
export const Route = createFileRoute('/focus')({
  validateSearch: parseFocusSearch,
  loader: () => getPlanView(),
  head: () => ({ meta: [{ title: m.focus() }] }),
  component: FocusRoute,
})

function FocusRoute() {
  const router = useRouter()
  const navigate = Route.useNavigate()
  const { plan, access } = Route.useLoaderData()
  const { session, expanded } = Route.useSearch()
  return (
    <FocusPage
      plan={plan}
      canEdit={access === 'owner'}
      session={session}
      onPick={(next) =>
        void navigate({ search: (prev) => ({ ...prev, session: next }), replace: true, resetScroll: false })
      }
      onChange={async (change) => {
        await savePlanChange({ data: change })
        await router.invalidate()
      }}
      expanded={expanded === true}
      onExpandedChange={(next) =>
        void navigate({ search: (prev) => ({ ...prev, expanded: next || undefined }), resetScroll: false })
      }
    />
  )
}
