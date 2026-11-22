import { ExportCalendars } from '@lc/calendar-export'
import { m } from '@lc/i18n/messages'
import { locales, setLocale } from '@lc/i18n/runtime'
import { PlannerPage, parsePlannerSearch, type PlannerCommand } from '@lc/planner'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { getPlanState, savePlanChange } from '#/server/plan'
import { LanguageSwitcher } from '#/shell/LanguageSwitcher'
import { setTheme } from '#/shell/theme'

/** The planner module rendered at `/`; the route only wires it to the URL, the server functions and the other modules. */
export const Route = createFileRoute('/')({
  validateSearch: parsePlannerSearch,
  loader: () => getPlanState(),
  component: PlannerRoute,
})

/** What the shell owns and offers in the planner's command palette: the theme and the language. */
const shellCommands = (): PlannerCommand[] => [
  { id: 'theme-system', group: m.theme(), label: m.theme_system(), run: () => setTheme('system') },
  { id: 'theme-light', group: m.theme(), label: m.theme_light(), run: () => setTheme('light') },
  { id: 'theme-dark', group: m.theme(), label: m.theme_dark(), run: () => setTheme('dark') },
  ...locales.map((locale) => ({
    id: `language-${locale}`,
    group: m.language(),
    label: locale.toUpperCase(),
    run: () => void setLocale(locale),
  })),
]

function PlannerRoute() {
  const navigate = Route.useNavigate()
  const router = useRouter()
  return (
    <PlannerPage
      state={Route.useLoaderData()}
      search={Route.useSearch()}
      onSearchChange={(patch) => void navigate({ search: (prev) => ({ ...prev, ...patch }) })}
      onChange={async (change) => {
        await savePlanChange({ data: change })
        await router.invalidate()
      }}
      headerAside={<LanguageSwitcher />}
      renderActions={({ plan, hidden }) => <ExportCalendars plan={plan} hidden={hidden} />}
      commands={shellCommands()}
    />
  )
}
