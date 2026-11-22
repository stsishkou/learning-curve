import { ExportCalendars } from '@lc/calendar-export'
import { PlannerPage, parsePlannerSearch } from '@lc/planner'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { getPlanState, saveEventEdit } from '#/server/plan'
import { LanguageSwitcher } from '#/shell/LanguageSwitcher'

/** The planner module rendered at `/`; the route only wires it to the URL, the server functions and the other modules. */
export const Route = createFileRoute('/')({
  validateSearch: parsePlannerSearch,
  loader: () => getPlanState(),
  component: PlannerRoute,
})

function PlannerRoute() {
  const navigate = Route.useNavigate()
  const router = useRouter()
  return (
    <PlannerPage
      state={Route.useLoaderData()}
      search={Route.useSearch()}
      onSearchChange={(patch) => void navigate({ search: (prev) => ({ ...prev, ...patch }) })}
      onSaveEdit={async (uid, patch) => {
        await saveEventEdit({ data: { uid, patch } })
        await router.invalidate()
      }}
      headerAside={<LanguageSwitcher />}
      renderActions={({ plan, hidden }) => <ExportCalendars plan={plan} hidden={hidden} />}
    />
  )
}
