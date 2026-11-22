import { ExportCalendars } from '@lc/calendar-export'
import { m } from '@lc/i18n/messages'
import { locales, setLocale } from '@lc/i18n/runtime'
import { PlannerPage, parsePlannerSearch, type PlannerCommand } from '@lc/planner'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { getBusy, getBusyFeed, saveBusyFeed } from '#/server/busy'
import { getPlanState, savePlanChange, travelPlanHistory } from '#/server/plan'
import { ShellAside, STAND_URL } from '#/shell/ShellAside'
import { setTheme } from '#/shell/theme'

/** The planner module rendered at `/`; the route only wires it to the URL, the server functions and the other modules. */
export const Route = createFileRoute('/')({
  validateSearch: parsePlannerSearch,
  loader: async () => {
    const [state, feed] = await Promise.all([getPlanState(), getBusyFeed()])
    return { state, feed }
  },
  component: PlannerRoute,
})

/** What the shell owns and offers in the planner's command palette: the theme and the language. */
const shellCommands = (open: (to: '/dashboard' | '/focus') => void): PlannerCommand[] => [
  { id: 'focus', group: m.nav(), label: m.focus(), run: () => open('/focus') },
  { id: 'dashboard', group: m.nav(), label: m.dashboard(), run: () => open('/dashboard') },
  ...(STAND_URL
    ? [{ id: 'stand', group: m.nav(), label: m.nav_components(), run: () => void window.open(STAND_URL, '_blank') }]
    : []),
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
  const { state, feed } = Route.useLoaderData()
  return (
    <PlannerPage
      state={state}
      search={Route.useSearch()}
      // The same page with another week, view or open event: the router would otherwise scroll it back to the top.
      onSearchChange={(patch) => void navigate({ search: (prev) => ({ ...prev, ...patch }), resetScroll: false })}
      onChange={async (change) => {
        await savePlanChange({ data: change })
        await router.invalidate()
      }}
      onTravel={async (cursor) => {
        await travelPlanHistory({ data: cursor })
        await router.invalidate()
      }}
      headerAside={<ShellAside />}
      renderActions={({ plan, hidden }) => <ExportCalendars plan={plan} hidden={hidden} />}
      busy={{
        host: feed.host,
        load: (from, to) => getBusy({ data: { from, to } }),
        save: feed.canSet
          ? async (url) => {
              await saveBusyFeed({ data: url })
              await router.invalidate()
            }
          : undefined,
      }}
      onFocus={(session) => void router.navigate({ to: '/focus', search: { session } })}
      commands={shellCommands((to) => void router.navigate({ to }))}
    />
  )
}
