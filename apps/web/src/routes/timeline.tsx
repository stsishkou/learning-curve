import { m } from '@lc/i18n/messages'
import type { Plan } from '@lc/plan-domain'
import type { RebalanceRequest } from '@lc/plan-domain/rebalance'
import { parseTimelineSearch, TimelinePage } from '@lc/planner'
import { createFileRoute, useBlocker, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { getPlanState, savePlanChanges, travelPlanHistory } from '#/server/plan'
import { rebalancePlan } from '#/server/reschedule'

/** The timeline page of the planner module at `/timeline`: every course on its lane, changed as a draft. */
export const Route = createFileRoute('/timeline')({
  validateSearch: parseTimelineSearch,
  loader: () => getPlanState(),
  head: () => ({ meta: [{ title: m.timeline() }] }),
  component: TimelineRoute,
})

// Outside the component: the page works its draft out again whenever this changes.
const rebalance = async (plan: Plan, request: RebalanceRequest) => rebalancePlan({ data: { plan, request } })

function TimelineRoute() {
  const router = useRouter()
  const navigate = Route.useNavigate()
  const { expanded } = Route.useSearch()
  const [dirty, setDirty] = useState(false)
  // The page asks itself before the browser leaves it; this holds a move to another section of the app, not a change
  // of this page's own state such as Expand.
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => dirty && current.routeId !== next.routeId,
    enableBeforeUnload: false,
    withResolver: true,
  })
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
      onDraftChange={setDirty}
      expanded={expanded === true}
      onExpandedChange={(next) => void navigate({ search: { expanded: next || undefined }, resetScroll: false })}
      leaving={blocker.status === 'blocked' ? { onStay: blocker.reset, onLeave: blocker.proceed } : undefined}
    />
  )
}
