import { DashboardPage, parseDashboardSearch } from '@lc/dashboard'
import { createFileRoute } from '@tanstack/react-router'

import { getPlanState } from '#/server/plan'
import { ShellAside } from '#/shell/ShellAside'

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
      headerAside={<ShellAside />}
    />
  )
}
