import { m } from '@lc/i18n/messages'
import { FocusPage } from '@lc/planner'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { getPlanState, savePlanChange } from '#/server/plan'
import { ShellAside } from '#/shell/ShellAside'

/** The focus page of the planner module at `/focus`: one session and a stopwatch that logs the time it took. */
/** `?session=<uid>` names the session to time, so a link from the planner opens the one that was picked. */
const parseSearch = (search: Record<string, unknown>): { session?: string | undefined } => ({
  session: typeof search.session === 'string' && search.session ? search.session : undefined,
})

export const Route = createFileRoute('/focus')({
  validateSearch: parseSearch,
  loader: () => getPlanState(),
  head: () => ({ meta: [{ title: m.focus() }] }),
  component: FocusRoute,
})

function FocusRoute() {
  const router = useRouter()
  const navigate = Route.useNavigate()
  const { plan, canEdit } = Route.useLoaderData()
  return (
    <FocusPage
      plan={plan}
      canEdit={canEdit}
      session={Route.useSearch().session}
      onPick={(session) => void navigate({ search: { session }, replace: true, resetScroll: false })}
      onChange={async (change) => {
        await savePlanChange({ data: change })
        await router.invalidate()
      }}
      headerAside={<ShellAside />}
    />
  )
}
