import { ExportDialog } from '@lc/calendar-export'
import { m } from '@lc/i18n/messages'
import { locales, setLocale } from '@lc/i18n/runtime'
import type { Plan } from '@lc/plan-domain'
import type { RebalanceRequest } from '@lc/plan-domain/rebalance'
import { PlannerPage, parsePlannerSearch, type PlannerCommand } from '@lc/planner'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { getBusy, getBusyFeed, saveBusyFeed } from '#/server/busy'
import {
  acceptCalendarProposals,
  disconnectCalendarFn,
  getCalendarStatuses,
  rejectCalendarProposals,
  saveCalendarClientFn,
  syncCalendarNow,
} from '#/server/calendars'
import { getPlanFile, getPlanFiles, removeSavedPlan, renameSavedPlan, savePlanFile } from '#/server/library'
import { getPlanState, savePlanChange, savePlanChanges, travelPlanHistory, trimPlanHistory } from '#/server/plan'
import { rebalancePlan } from '#/server/reschedule'
import { STAND_URL } from '#/shell/ShellBar'
import { setTheme } from '#/shell/theme'

/** The planner module rendered at `/`; the route only wires it to the URL, the server functions and the other modules. */
export const Route = createFileRoute('/')({
  validateSearch: parsePlannerSearch,
  loader: async () => {
    const [state, feed, calendars] = await Promise.all([getPlanState(), getBusyFeed(), getCalendarStatuses()])
    return { state, feed, calendars }
  },
  component: PlannerRoute,
})

/** What the shell owns and offers in the planner's command palette: the theme and the language. */
const shellCommands = (open: (to: '/dashboard' | '/focus' | '/timeline') => void): PlannerCommand[] => [
  { id: 'timeline', group: m.nav(), label: m.timeline(), run: () => open('/timeline') },
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

// Outside the component, so the dialog does not ask again each time the route renders.
const rebalance = async (plan: Plan, request: RebalanceRequest) => rebalancePlan({ data: { plan, request } })

function PlannerRoute() {
  const navigate = Route.useNavigate()
  const router = useRouter()
  const { state, feed, calendars } = Route.useLoaderData()
  // A round that took edits made in the app into the plan changed it: the page reads it again.
  const readAgain = async <T extends { provider: string; takenAt: number | null }>(next: T) => {
    const before = calendars.find((status) => status.provider === next.provider)
    if (next.takenAt !== before?.takenAt) await router.invalidate()
    return next
  }
  return (
    <PlannerPage
      state={state}
      search={Route.useSearch()}
      // The same page with another week, view or open event: the router would otherwise scroll it back to the top.
      onSearchChange={(patch) =>
        void navigate({
          search: (prev) => ({ ...prev, ...patch }),
          resetScroll: false,
          // Another view or period fades in; opening an event must not, or the grid would blink under its card.
          viewTransition: 'view' in patch || 'week' in patch || 'day' in patch,
        })
      }
      onChange={async (change) => {
        await savePlanChange({ data: change })
        await router.invalidate()
      }}
      onTravel={async (cursor) => {
        await travelPlanHistory({ data: cursor })
        await router.invalidate()
      }}
      onTrimHistory={async () => {
        await trimPlanHistory()
        await router.invalidate()
      }}
      onChangeAll={async (changes) => {
        await savePlanChanges({ data: changes })
        await router.invalidate()
      }}
      library={
        state.canEdit
          ? {
              list: () => getPlanFiles(),
              read: (id, version) => getPlanFile({ data: { id, version } }),
              save: (file) => savePlanFile({ data: file }),
              rename: async (id, name) => void (await renameSavedPlan({ data: { id, name } })),
              remove: async (id, version) => void (await removeSavedPlan({ data: { id, version } })),
            }
          : undefined
      }
      renderExport={(dialog) => <ExportDialog {...dialog} />}
      rebalance={rebalance}
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
      sync={calendars
        .filter((status) => status.writable)
        .map((status) => {
          const { provider } = status
          return {
            status,
            connectUrl: `/api/${provider}/connect`,
            callbackPath: `/api/${provider}/callback`,
            // The dialog goes on to the app's sign-in right after, which reloads the page.
            saveClient: async (id, secret) => {
              await saveCalendarClientFn({ data: { provider, id, secret } })
            },
            sync: async () => readAgain(await syncCalendarNow({ data: provider })),
            accept: async (ids) => readAgain(await acceptCalendarProposals({ data: { provider, ids } })),
            reject: async (ids) => readAgain(await rejectCalendarProposals({ data: { provider, ids } })),
            disconnect: async () => {
              await disconnectCalendarFn({ data: provider })
              await router.invalidate()
            },
          }
        })}
      onFocus={(session) => void router.navigate({ to: '/focus', search: { session } })}
      commands={shellCommands((to) => void router.navigate({ to }))}
    />
  )
}
