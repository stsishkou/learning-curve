import { ExportCalendars } from '@lc/calendar-export'
import { m } from '@lc/i18n/messages'
import { locales, setLocale } from '@lc/i18n/runtime'
import { PlannerPage, parsePlannerSearch, type PlannerCommand } from '@lc/planner'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { getBusy, getBusyFeed, saveBusyFeed } from '#/server/busy'
import {
  acceptGoogleProposals,
  disconnectGoogleFn,
  getGoogleStatus,
  rejectGoogleProposals,
  saveGoogleClientFn,
  syncGoogleNow,
} from '#/server/google'
import { getPlanFile, getPlanFiles, removeSavedPlan, renameSavedPlan, savePlanFile } from '#/server/library'
import { getPlanState, savePlanChange, savePlanChanges, travelPlanHistory } from '#/server/plan'
import { ShellAside, STAND_URL } from '#/shell/ShellAside'
import { setTheme } from '#/shell/theme'

/** The planner module rendered at `/`; the route only wires it to the URL, the server functions and the other modules. */
export const Route = createFileRoute('/')({
  validateSearch: parsePlannerSearch,
  loader: async () => {
    const [state, feed, google] = await Promise.all([getPlanState(), getBusyFeed(), getGoogleStatus()])
    return { state, feed, google }
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
  const { state, feed, google } = Route.useLoaderData()
  // A round that took edits made in Google into the plan changed it: the page reads it again.
  const readAgain = async <T extends { takenAt: number | null }>(next: T) => {
    if (next.takenAt !== google.takenAt) await router.invalidate()
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
      google={
        google.writable
          ? {
              status: google,
              connectUrl: '/api/google/connect',
              callbackPath: '/api/google/callback',
              // The dialog goes on to Google's sign-in right after, which reloads the page.
              saveClient: async (id, secret) => {
                await saveGoogleClientFn({ data: { id, secret } })
              },
              sync: async () => readAgain(await syncGoogleNow()),
              accept: async (ids) => readAgain(await acceptGoogleProposals({ data: ids })),
              reject: async (ids) => readAgain(await rejectGoogleProposals({ data: ids })),
              disconnect: async () => {
                await disconnectGoogleFn()
                await router.invalidate()
              },
            }
          : undefined
      }
      onFocus={(session) => void router.navigate({ to: '/focus', search: { session } })}
      commands={shellCommands((to) => void router.navigate({ to }))}
    />
  )
}
