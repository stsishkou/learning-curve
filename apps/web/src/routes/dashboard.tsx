import { DashboardPage } from '@lc/dashboard'
import { createFileRoute } from '@tanstack/react-router'

import { getPlanState } from '#/server/plan'
import { ShellAside } from '#/shell/ShellAside'

/** The dashboard module rendered at `/dashboard`: the same plan as the planner, read-only. */
export const Route = createFileRoute('/dashboard')({
  loader: () => getPlanState(),
  component: DashboardRoute,
})

function DashboardRoute() {
  return <DashboardPage plan={Route.useLoaderData().plan} headerAside={<ShellAside />} />
}
