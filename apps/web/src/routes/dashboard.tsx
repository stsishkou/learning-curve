import { DashboardPage, parseDashboardSearch } from '@lc/dashboard'
import { mondayOf, parseLocal, ymd } from '@lc/plan-domain'
import { createFileRoute } from '@tanstack/react-router'

import { getPlanState } from '#/server/plan'

/** The dashboard module rendered at `/dashboard`: the same plan as the planner, read-only. */
export const Route = createFileRoute('/dashboard')({
  validateSearch: parseDashboardSearch,
  loader: () => getPlanState(),
  component: DashboardRoute,
})

function DashboardRoute() {
  const navigate = Route.useNavigate()
  return (
    <DashboardPage
      plan={Route.useLoaderData().plan}
      expanded={Route.useSearch().expanded === true}
      onExpandedChange={(next) => void navigate({ search: { expanded: next || undefined }, resetScroll: false })}
      onFillTimes={() => void navigate({ to: '/', search: { fill: true } })}
      onCatchUp={() => void navigate({ to: '/', search: { open: 'catchUp' } })}
      // The planner opens on the week Reschedule starts in.
      onReschedule={({ from, calendar }) =>
        void navigate({
          to: '/',
          search: { reschedule: from, calendar, week: ymd(mondayOf(parseLocal(`${from}T00:00`))) },
        })
      }
    />
  )
}
