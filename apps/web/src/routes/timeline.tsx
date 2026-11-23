import { m } from '@lc/i18n/messages'
import type { Plan, RebalanceRequest } from '@lc/plan-domain'
import { TimelinePage } from '@lc/planner'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { getPlanState, savePlanChanges, travelPlanHistory } from '#/server/plan'
import { rebalancePlan } from '#/server/reschedule'
import { ShellAside } from '#/shell/ShellAside'

/** The timeline page of the planner module at `/timeline`: every course on its lane, changed as a draft. */
export const Route = createFileRoute('/timeline')({
  loader: () => getPlanState(),
  head: () => ({ meta: [{ title: m.timeline() }] }),
  component: TimelineRoute,
})

// Outside the component: the page works its draft out again whenever this changes.
const rebalance = async (plan: Plan, request: RebalanceRequest) => rebalancePlan({ data: { plan, request } })

function TimelineRoute() {
  const router = useRouter()
  return (
    <TimelinePage
      state={Route.useLoaderData()}
      onChangeAll={async (changes) => {
        await savePlanChanges({ data: changes })
        await router.invalidate()
      }}
      onTravel={async (cursor) => {
        await travelPlanHistory({ data: cursor })
        await router.invalidate()
      }}
      rebalance={rebalance}
      headerAside={<ShellAside />}
    />
  )
}
