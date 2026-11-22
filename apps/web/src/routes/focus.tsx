import { m } from '@lc/i18n/messages'
import { FocusPage } from '@lc/planner'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { getPlanState, savePlanChange } from '#/server/plan'
import { ShellAside } from '#/shell/ShellAside'

/** The focus page of the planner module at `/focus`: one session and a stopwatch that logs the time it took. */
export const Route = createFileRoute('/focus')({
  loader: () => getPlanState(),
  head: () => ({ meta: [{ title: m.focus() }] }),
  component: FocusRoute,
})

function FocusRoute() {
  const router = useRouter()
  const { plan, canEdit } = Route.useLoaderData()
  return (
    <FocusPage
      plan={plan}
      canEdit={canEdit}
      onChange={async (change) => {
        await savePlanChange({ data: change })
        await router.invalidate()
      }}
      headerAside={<ShellAside />}
    />
  )
}
