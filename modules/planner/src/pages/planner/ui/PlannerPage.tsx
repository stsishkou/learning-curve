import { m } from '@lc/i18n/messages'
import {
  DAY,
  HOUR,
  addDays,
  deadlineOf,
  doneWithoutTime,
  hiddenCalendarIds,
  isSession,
  mondayOf,
  moveOccurrence,
  nextFreeSlot,
  nowMinsk,
  occurrences,
  parseLocal,
  planLabels,
  planStart,
  removeOccurrence,
  shownPlan,
  startOfDay,
  toLocalString,
  ymd,
  zoneShift,
  type CalendarProvider,
  type HistoryStep,
  type Occurrence,
  type Plan,
  type PlanEvent,
} from '@lc/plan-domain'
import { planFileName } from '@lc/plan-domain/ics'
import { reviewOffers } from '@lc/plan-domain/insights'
import type { RebalanceRequest, RebalanceResult } from '@lc/plan-domain/rebalance'
import { Hint, useFullscreen, useHelpMode, useIconsOnly, useShortcuts } from '@lc/ui'
import { useMemo, useState, type ReactNode } from 'react'

import { Backlog } from '../../../features/backlog'
import { BusyFeedDialog, useBusy, type BusySource } from '../../../features/busy-overlay'
import {
  attentionOf,
  CalendarReviewBar,
  CalendarReviewDialog,
  CalendarSyncDialog,
  IntegrationsDialog,
  takenFromApps,
  useCalendarSync,
  useSeenFromApps,
  type CalendarSyncSource,
} from '../../../features/calendar-sync'
import { CatchUpDialog } from '../../../features/catch-up'
import { CommandPalette, type Command } from '../../../features/command-palette'
import { EventDialog } from '../../../features/edit-event'
import { CalendarFilter, LabelFilter, useHiddenCalendars } from '../../../features/filter-calendars'
import { describeStep, HistoryDialog } from '../../../features/history'
import { ShortcutsDialog } from '../../../features/keyboard-shortcuts'
import { LogDoneDialog, ResizedDoneDialog, UnloggedBar, type ResizedDone } from '../../../features/log-done'
import { CalendarsDialog, NewCourseDialog } from '../../../features/manage-calendars'
import { FileBanner, PlanFileReader, type PlanLibrary } from '../../../features/open-plan-file'
import { ReviewBar, useDismissedReviews } from '../../../features/plan-reviews'
import { CountdownDialog, SettingsDialog } from '../../../features/plan-settings'
import { useReminders } from '../../../features/reminders'
import { RescheduleDialog, type ReschedulePreset } from '../../../features/reschedule'
import { SecondZoneDialog, useSecondZone } from '../../../features/second-zone'
import { TrashDialog } from '../../../features/trash'
import { LastWeekBar, WeekReviewDialog } from '../../../features/week-review'
import { appName, eventKey, useModKey, useNow, type SessionActions } from '../../../shared/lib'
import { AgendaList } from '../../../widgets/agenda-list'
import { BudgetLine } from '../../../widgets/budget-panel'
import { MonthGrid } from '../../../widgets/month-grid'
import { NowNext } from '../../../widgets/now-next'
import { Runway } from '../../../widgets/runway'
import { WeekGrid } from '../../../widgets/week-grid'
import { YearGrid } from '../../../widgets/year-grid'
import { buildActions, type DialogName } from '../model/build-actions'
import { toCommands, toMenuItem, toMenuItems, toShortcutRows, toShortcuts } from '../model/planner-actions'
import type { PlannerSearch } from '../model/search'
import { useDialogFlags } from '../model/use-dialog-flags'
import { useEventDraft } from '../model/use-event-draft'
import { usePlanSession, type PlannerPlan } from '../model/use-plan-session'
import { usePlannerView } from '../model/use-planner-view'
import { useQuietChange } from '../model/use-quiet-change'
import { useWidePanels, type WidePanels } from '../model/use-wide-panels'
import { InsightTabs } from './InsightTabs'
import { OverdueBar } from './OverdueBar'
import { PlanHeading } from './PlanHeading'
import { PlannerToolbar } from './PlannerToolbar'
import { UndoBar } from './UndoBar'

/** The part of the view kept in the URL, and how to change it */
export interface PlannerUrl {
  /** The week, the view, the open event */
  search: PlannerSearch
  /** Merges the given keys into the URL; `undefined` removes a key. */
  onSearchChange: (patch: PlannerSearch) => void
}

/** What the host may be able to do beyond the plan itself; each one the host lacks is left out and its controls hide */
export interface PlannerAbilities {
  /** Present when the host keeps plan files with versions: the plan file reader lists them */
  library?: PlanLibrary | undefined
  /** Present when the host can read the person's own calendar: its busy time is drawn behind the plan */
  busy?: BusySource | undefined
  /** The calendar apps the host can keep the plan in and read edits made there back from; absent where it cannot */
  sync?: readonly CalendarSyncSource[] | undefined
  /** Present when the host can work out a re-balance of a calendar: the Reschedule dialog then offers it */
  rebalance?: ((plan: Plan, request: RebalanceRequest) => Promise<RebalanceResult>) | undefined
  /** Present when the host has a focus page: called with the uid of the session to time there */
  focus?: ((uid: string) => void) | undefined
}

/** What other modules and the host put into the page: their own controls and dialogs */
export interface PlannerSlots {
  /** More actions that work on the plan as it is shown now, such as export: at the end of the plan's name row */
  renderActions?: ((shown: { plan: Plan; hidden: ReadonlySet<string> }) => ReactNode) | undefined
  /** The export dialog, from the module that writes the files: the calendar integrations offer it when present */
  renderExport?:
    | ((dialog: { plan: Plan; hidden: ReadonlySet<string>; open: boolean; onClose: () => void }) => ReactNode)
    | undefined
  /** Host actions listed in the command palette, such as the theme */
  commands?: readonly Command[] | undefined
}

/** What the planner page takes from its host */
export interface PlannerPageProps {
  /** The plan on screen and how it is changed */
  plan: PlannerPlan
  /** The part of the view kept in the URL */
  url: PlannerUrl
  /** What the host can do besides; absent, the page offers none of it */
  abilities?: PlannerAbilities | undefined
  /** The controls and dialogs the host adds to the page */
  slots?: PlannerSlots | undefined
}

const NO_CALENDARS: ReadonlySet<string> = new Set()
const NO_APPS: readonly CalendarSyncSource[] = []

/** What the notice says about the latest edits taken from calendar apps, oldest first. */
function takenLabel(steps: HistoryStep[]): string {
  const [first] = steps
  const apps = new Set(steps.map((step) => step.source))
  const [source] = apps
  if (!first || apps.size > 1 || !source) return m.sync_took_apps({ count: steps.length })
  const app = appName(source)
  return steps.length > 1
    ? m.sync_took_many({ app, count: steps.length })
    : m.sync_took_one({ app, what: describeStep(first) })
}

/**
 * The whole planner: the toolbar, the calendar in one of its views, the side panel and every dialog. It loads and
 * saves nothing itself. The host passes the plan and the URL state in and receives each edit as one `PlanChange`
 * and each undo or redo as a position in the history.
 */
export function PlannerPage({ plan: hostPlan, url, abilities, slots }: PlannerPageProps) {
  const { search, onSearchChange } = url
  const { library, busy, sync, rebalance, focus: onFocus } = abilities ?? {}
  const { renderActions, renderExport, commands } = slots ?? {}
  const now = useNow()
  const mod = useModKey()
  const { hidden, toggle, solo, showOnly, showAll, reset } = useHiddenCalendars()
  const session = usePlanSession(hostPlan)
  const { plan: wholePlan, canEdit } = session
  // Calendars hidden from the list are out of every view; what saves, exports or re-plans still gets the whole plan.
  const plan = useMemo(() => shownPlan(wholePlan), [wholePlan])
  const nav = usePlannerView(plan, search, onSearchChange)
  const { view, weekStart } = nav
  const fullscreen = useFullscreen()
  // The whole screen is for the calendar: it is laid out as Expand lays it out.
  const expanded = nav.expanded || fullscreen.on
  const widePanels = useWidePanels()
  // What is remembered for the wide layout never hides a panel of the regular one.
  const side: WidePanels = expanded ? widePanels.shown : { next: true, insights: true }
  const quiet = useQuietChange(session)
  // A sign-in to a calendar app comes back to the page with its outcome: that app's dialog shows how it went.
  const dialogs = useDialogFlags<DialogName>([
    ...(search.link ? (['sync'] as const) : []),
    ...(search.open === 'catchUp' ? (['catchUp'] as const) : []),
  ])
  const [shownApp, setShownApp] = useState<CalendarProvider | null>(search.link ?? null)
  const apps = useCalendarSync(sync ?? NO_APPS)
  const shownSource = sync?.find((source) => source.status.provider === shownApp)
  const shownStatus = apps.statuses.find((status) => status.provider === shownApp)
  const attention = apps.statuses.some((status) => attentionOf(status) !== null)
  // Edits from the apps come in by themselves; the latest ones get the same bar as a change made here.
  const fromApps = takenFromApps(session.history)
  const seenApps = useSeenFromApps(fromApps)
  const drafting = useEventDraft({ plan, hidden, now, first: nav.grid.start, days: nav.grid.days, canEdit })

  const [zone, setZone] = useSecondZone()
  const zoneAhead = zone ? zoneShift(zone, nav.grid.start + 12 * HOUR) : null
  // The city is enough to tell the clocks apart: `Europe/Warsaw` reads as Warsaw.
  const secondZone =
    zone && zoneAhead !== null
      ? { label: zone.slice(zone.lastIndexOf('/') + 1).replaceAll('_', ' '), shift: zoneAhead }
      : null

  // What the calendar shows: a week, or the weeks of the month grid.
  const shownFrom = view === 'month' ? nav.monthGridStart : weekStart
  const taken = useBusy(busy, shownFrom, shownFrom + (view === 'month' ? nav.monthWeeks : 1) * 7 * DAY)
  // A calendar that is connected but cannot be changed here has nothing to open.
  const busyAction = busy && (busy.save || busy.host) ? { host: busy.host } : undefined

  // The day Reschedule opens from, and the calendar it opens with; null while it is closed.
  /** Re-balances one calendar from a day: to finish before its deadline while that is still ahead. */
  const rebalanceFrom = (from: string, calendar: string): ReschedulePreset => {
    const deadline = deadlineOf(wholePlan, calendar)
    return { calendar, mode: 'rebalance', finishBy: deadline && deadline > from ? addDays(deadline, -1) : undefined }
  }
  const [reschedule, setReschedule] = useState<{ from: string; preset?: ReschedulePreset | undefined } | null>(() => {
    if (!search.reschedule) return null
    const linked = wholePlan.calendars.find((c) => c.id === search.calendar)
    return { from: search.reschedule, preset: linked ? rebalanceFrom(search.reschedule, linked.id) : undefined }
  })
  const [overdueHidden, setOverdueHidden] = useState(false)
  // The week the review dialog shows when it is opened for one other than the week on screen.
  const [reviewMonday, setReviewMonday] = useState<number | null>(null)
  const [lastWeekHidden, setLastWeekHidden] = useState(false)
  const [unloggedHidden, setUnloggedHidden] = useState(false)
  // Done sessions without a time, in date order: the pace cannot count them until their time is filled in.
  const unlogged = useMemo(
    () =>
      plan.events
        .filter(doneWithoutTime)
        .toSorted((a, b) => a.start.localeCompare(b.start))
        .map((e) => e.uid),
    [plan],
  )
  /**
   * Sessions waiting for their times: marked done in bulk, or done without one. Kept as they were when the list
   * opened, so saving does not change its rows under it.
   */
  const [logDone, setLogDone] = useState<string[]>(() => (search.fill ? unlogged : []))
  const [resized, setResized] = useState<ResizedDone | null>(null)
  // A done session made longer or shorter may mean the time it took rather than a new plan: the page asks which.
  const moveInGrid = (o: Occurrence, slot: { s: number; e: number }) => {
    if (o.done && isSession(o) && slot.e - slot.s !== o.e - o.s) setResized({ event: o, slot })
    else quiet.change(moveOccurrence(o, slot))
  }
  // Which repeat of a repeating event was opened, `YYYY-MM-DD`: the URL only names the series.
  const [pickedDay, setPickedDay] = useState<string | null>(null)

  const selected = plan.events.find((e) => e.uid === search.event) ?? null
  const select = (e: PlanEvent | Occurrence) => {
    setPickedDay('s' in e ? ymd(e.s) : null)
    onSearchChange({ event: e.uid })
  }
  const trashCount = session.trash.events.length + session.trash.calendars.length
  const exportHidden = useMemo(() => new Set([...hidden, ...hiddenCalendarIds(wholePlan)]), [hidden, wholePlan])

  const weekItems = useMemo(() => occurrences(plan, weekStart, weekStart + 7 * DAY, hidden), [plan, weekStart, hidden])
  const kept = (o: Occurrence) => !(nav.hideDone && o.done)
  const monthItems =
    view === 'month'
      ? occurrences(plan, nav.monthGridStart, nav.monthGridStart + nav.monthWeeks * 7 * DAY, hidden).filter(kept)
      : []
  const gridItems = weekItems.filter(
    (o) => o.s >= nav.grid.start && o.s < nav.grid.start + nav.grid.days * DAY && kept(o),
  )
  const yearItems = useMemo(
    () => (view === 'year' ? occurrences(plan, Date.UTC(nav.year, 0, 1), Date.UTC(nav.year + 1, 0, 1), hidden) : []),
    [plan, hidden, view, nav.year],
  )
  const allItems = useMemo(
    () => (view === 'list' ? occurrences(plan, planStart(plan), parseLocal(plan.meta.planEnd) + 8 * DAY, hidden) : []),
    [plan, hidden, view],
  )
  const today = now === null ? null : startOfDay(now)
  const upcoming = useMemo(
    () => (today === null ? [] : occurrences(plan, today, today + 21 * DAY, NO_CALENDARS).filter((o) => !o.allDay)),
    [plan, today],
  )

  const reminders = useReminders(upcoming)
  const [helpOn, toggleHelp] = useHelpMode()
  const [iconsOnly, toggleIconsOnly] = useIconsOnly()

  // Sessions that should be over and are not marked done: the plan and the reality have drifted apart.
  const overdue = useMemo(
    () =>
      now === null
        ? []
        : plan.events
            .filter((e) => isSession(e) && !e.done && parseLocal(e.end) < now)
            .toSorted((a, b) => a.start.localeCompare(b.start)),
    [plan, now],
  )
  // Last week, while it had sessions and has no review kept yet.
  const lastMonday = today === null ? null : mondayOf(today) - 7 * DAY
  const lastWeekOpen = useMemo(
    () =>
      lastMonday !== null &&
      !wholePlan.weekNotes?.some((note) => note.week === ymd(lastMonday)) &&
      plan.events.some((e) => {
        const start = parseLocal(e.start)
        return isSession(e) && start >= lastMonday && start < lastMonday + 7 * DAY
      }),
    [plan, wholePlan.weekNotes, lastMonday],
  )
  const sessionActions: SessionActions | undefined = canEdit
    ? {
        done: (uid) => setLogDone([uid]),
        skip: (uid) => quiet.change({ type: 'event.patch', uid, patch: { done: true, skipped: true } }),
        unskip: (uid) => quiet.change({ type: 'event.patch', uid, patch: { done: false } }),
        move: (o) => {
          // The whole plan: a hidden calendar's sessions still take their slots.
          const slot = nextFreeSlot(wholePlan, {
            from: nowMinsk(),
            length: o.e - o.s,
            preferHour: new Date(o.s).getUTCHours(),
            except: { uid: o.uid, s: o.s, e: o.e, study: o.calendar !== 'personal' },
            busy: taken.blocks,
          })
          if (!slot) return false
          quiet.change({
            type: 'event.patch',
            uid: o.uid,
            patch: { start: toLocalString(slot.s), end: toLocalString(slot.e) },
          })
          return true
        },
      }
    : undefined

  // A missed session being dragged from the backlog onto the grid.
  const [carried, setCarried] = useState<PlanEvent | null>(null)
  const dropCarried = (start: number) => {
    if (!carried) return
    // Not left to the end of the drag: the chip may be gone before it, and the grid would go on taking drops.
    setCarried(null)
    const length = parseLocal(carried.end) - parseLocal(carried.start)
    quiet.change({
      type: 'event.patch',
      uid: carried.uid,
      patch: { start: toLocalString(start), end: toLocalString(start + length) },
    })
  }

  // Finished modules that have no reviews yet; one is offered at a time.
  const declined = useDismissedReviews()
  const reviews = useMemo(() => (now === null || !canEdit ? [] : reviewOffers(plan, now)), [plan, now, canEdit])
  const waiting = reviews.filter((offer) => !declined.dismissed.includes(offer.key))
  const [offer] = waiting

  // One repeat of a series, not all of them: the one that was opened, or the first on screen after a reload.
  const selectedShown = selected
    ? (view === 'month' ? monthItems : gridItems).find(
        (o) => o.uid === selected.uid && (!pickedDay || ymd(o.s) === pickedDay),
      )
    : undefined
  const selectedKey = selectedShown ? eventKey(selectedShown) : null
  const dialogAnchor = () =>
    drafting.draft
      ? document.querySelector('[data-draft]')
      : selectedKey
        ? document.querySelector(`[data-key="${CSS.escape(selectedKey)}"]`)
        : null

  const allIds = plan.calendars.map((c) => c.id)
  const only = (id: string) => solo([id], allIds)
  const shift = () => setReschedule({ from: ymd(today ?? weekStart) })

  const { cursor, steps } = session.history
  const actions = buildActions({
    nav,
    canEdit,
    calendars: plan.calendars,
    hiddenCount: hidden.size,
    history: { cursor, total: steps.length, ...quiet },
    secondZone: secondZone?.label,
    integrations: { waiting: apps.held.length, attention },
    reminders: reminders.supported ? reminders : undefined,
    fullscreen: fullscreen.supported ? fullscreen : undefined,
    panels: expanded ? widePanels : undefined,
    help: { on: helpOn, toggle: toggleHelp },
    iconsOnly: { on: iconsOnly, toggle: toggleIconsOnly },
    trashCount,
    overdueCount: overdue.length,
    open: dialogs.show,
    newEvent: () => drafting.begin(),
    shift,
    only,
    showAll,
  })
  const palette: Command[] = [
    ...toCommands(actions),
    ...planLabels(plan).map((label): Command => ({
      id: `label:${label.name}`,
      label: m.palette_only_label({ label: label.name }),
      group: m.labels(),
      pinned: true,
      run: () => showOnly(label.calendars, allIds),
    })),
    ...(commands ?? []),
  ]

  useShortcuts({
    'mod+k': () => dialogs.show('palette'),
    '/': () => dialogs.show('palette'),
    ...toShortcuts(actions),
    'mod+z': quiet.undo,
    'mod+shift+z': quiet.redo,
    // The same key as `+` without Shift.
    '=': nav.zoomIn,
    arrowleft: () => nav.step(-1),
    arrowright: () => nav.step(1),
  })

  return (
    <div className={`mx-auto px-3 pt-3.5 pb-10 md:px-5 md:pt-5 md:pb-12 ${expanded ? '' : 'max-w-[1240px]'}`}>
      {session.file && (
        <FileBanner
          name={session.file.name}
          changes={session.file.changes}
          onDownload={session.downloadFile}
          onSave={
            library &&
            (async () => {
              const saved = await library.save({ id: session.file?.origin, name: session.file?.name ?? '', plan })
              session.fileSaved(saved.id)
            })
          }
          onClose={session.closeFile}
        />
      )}

      {!expanded && (
        <>
          <PlanHeading
            plan={plan}
            onRename={canEdit ? (title) => quiet.change({ type: 'plan.rename', title }) : undefined}
          >
            <Hint title={m.help_file_title()} text={m.help_file()} />
            {renderActions && <div className="ml-auto flex gap-2">{renderActions({ plan, hidden })}</div>}
          </PlanHeading>

          <Runway
            plan={plan}
            now={now}
            onSelect={select}
            onConfigure={canEdit ? () => dialogs.show('countdown') : undefined}
            onReschedule={
              canEdit
                ? (calendar) => {
                    const from = ymd(today ?? weekStart)
                    setReschedule({ from, preset: rebalanceFrom(from, calendar) })
                  }
                : undefined
            }
          />
        </>
      )}

      <PlannerToolbar
        nav={nav}
        mod={mod}
        menu={toMenuItems(actions)}
        onSearch={() => dialogs.show('palette')}
        onNewEvent={canEdit ? () => drafting.begin() : undefined}
        history={canEdit ? quiet : undefined}
        pinned={expanded}
        fullscreen={fullscreen.supported ? fullscreen : undefined}
        panels={
          expanded
            ? actions.filter((a) => a.id === 'panel-next' || a.id === 'panel-insights').map(toMenuItem)
            : undefined
        }
        summary={expanded && view === 'week' && <BudgetLine plan={plan} weekItems={weekItems} />}
        attention={attention}
      >
        <LabelFilter
          calendars={plan.calendars}
          hidden={hidden}
          onOnly={(ids) => solo(ids, allIds)}
          onShowAll={showAll}
        />
        <Hint title={m.help_calendars_title()} text={m.help_calendars()} />
        <CalendarFilter
          calendars={plan.calendars}
          hidden={hidden}
          onToggle={toggle}
          onSolo={only}
          onShowAll={hidden.size ? showAll : undefined}
          onManage={canEdit ? () => dialogs.show('calendars') : undefined}
        />
      </PlannerToolbar>

      {canEdit && overdue.length > 0 && !overdueHidden && (
        <OverdueBar
          count={overdue.length}
          onMarkDone={() => setLogDone(overdue.map((e) => e.uid))}
          onCatchUp={() => dialogs.show('catchUp')}
          onDismiss={() => setOverdueHidden(true)}
        />
      )}

      {canEdit && unlogged.length > 0 && !unloggedHidden && (
        <UnloggedBar
          count={unlogged.length}
          onFill={() => setLogDone(unlogged)}
          onDismiss={() => setUnloggedHidden(true)}
        />
      )}

      {canEdit && !overdueHidden && (view === 'week' || view === 'day') && (
        <Backlog plan={plan} events={overdue} onSelect={select} onCarry={setCarried} />
      )}

      {canEdit && apps.held.length > 0 && (
        <CalendarReviewBar count={apps.held.length} onReview={() => dialogs.show('syncReview')} />
      )}

      {canEdit && lastWeekOpen && lastMonday !== null && !lastWeekHidden && (
        <LastWeekBar
          monday={lastMonday}
          onReview={() => setReviewMonday(lastMonday)}
          onDismiss={() => setLastWeekHidden(true)}
        />
      )}

      {offer && (
        <ReviewBar
          offer={offer}
          more={waiting.length - 1}
          onPlan={() => quiet.change({ type: 'reviews.plan', reviews: offer.reviews })}
          onDismiss={() => declined.dismiss(offer.key)}
        />
      )}

      {reminders.blocked && (
        <p className="mb-3 text-[13px] text-today-ink" role="alert">
          {m.reminders_blocked()}
        </p>
      )}
      {taken.error && (
        <p className="mb-3 text-[13px] text-today-ink" role="alert">
          {m.busy_failed({ reason: taken.error })}
        </p>
      )}
      {quiet.saveError && (
        <p className="mb-3 text-[13px] text-today-ink" role="alert">
          {quiet.saveError}
        </p>
      )}
      {canEdit && fromApps.length > 0 && seenApps.unseen ? (
        <UndoBar
          label={takenLabel(fromApps)}
          onUndo={() => quiet.back(fromApps.length)}
          onHistory={() => dialogs.show('history')}
          onDismiss={seenApps.dismiss}
        />
      ) : (
        quiet.lastStep && (
          <UndoBar
            label={quiet.lastStep.label}
            warnings={quiet.lastStep.warnings}
            onUndo={quiet.undo}
            onHistory={() => dialogs.show('history')}
            onDismiss={session.dismissLastStep}
          />
        )
      )}

      <div
        className={`grid grid-cols-1 items-start gap-4 ${side.next || side.insights ? 'lg:grid-cols-[1fr_280px]' : ''}`}
      >
        <section className="lc-calendar relative min-w-0 rounded-2xl border border-line bg-surface">
          {(view === 'week' || view === 'day') && (
            <Hint title={m.help_grid_title()} text={m.help_grid()} className="absolute top-1.5 left-1.5 z-10" />
          )}
          {(view === 'week' || view === 'day') && (
            <WeekGrid
              plan={plan}
              weekStart={nav.grid.start}
              dayCount={nav.grid.days}
              hourHeight={nav.hourHeight}
              fullDay={nav.fullDay}
              items={gridItems}
              now={now}
              onSelect={select}
              onMove={canEdit ? moveInGrid : undefined}
              onRemove={canEdit ? (o) => quiet.change(removeOccurrence(o)) : undefined}
              onCreate={canEdit ? drafting.begin : undefined}
              draft={drafting.slot}
              secondZone={secondZone}
              busy={taken.blocks}
              selectedKey={selectedKey}
              carried={carried}
              onDropIn={canEdit ? dropCarried : undefined}
            />
          )}
          {view === 'month' && (
            <MonthGrid
              plan={plan}
              monthStart={nav.monthStart}
              gridStart={nav.monthGridStart}
              weeks={nav.monthWeeks}
              items={monthItems}
              now={now}
              onSelect={select}
              onPickDay={nav.showWeek}
              onMove={canEdit ? (o, slot) => quiet.change(moveOccurrence(o, slot)) : undefined}
            />
          )}
          {view === 'year' && (
            <YearGrid
              plan={plan}
              year={nav.year}
              items={yearItems}
              now={now}
              onPickDay={nav.showWeek}
              onPickMonth={(month) => onSearchChange({ view: 'month', week: ymd(mondayOf(month + 6 * DAY)) })}
            />
          )}
          {view === 'list' && (
            <AgendaList
              plan={plan}
              items={allItems}
              now={now}
              onSelect={select}
              onChanges={canEdit ? quiet.changeAll : undefined}
              onMarkDone={canEdit ? setLogDone : undefined}
            />
          )}
        </section>
        {(side.next || side.insights) && (
          // On one column the day comes before the calendar; the list is long, so its insights go above it too.
          <aside className="grid min-w-0 gap-4 max-lg:contents print:hidden">
            {side.next && (
              <div data-panel="next" className="min-w-0 max-lg:order-first print:hidden">
                <NowNext
                  plan={plan}
                  upcoming={upcoming}
                  now={now}
                  onSelect={select}
                  onFocus={onFocus}
                  actions={sessionActions}
                />
              </div>
            )}
            {side.insights && (
              <div
                data-panel="insights"
                className={`min-w-0 print:hidden ${view === 'list' ? 'max-lg:order-first' : ''}`}
              >
                <InsightTabs
                  plan={plan}
                  weekItems={weekItems}
                  hidden={hidden}
                  now={now}
                  weekStart={weekStart}
                  shown={nav.grid}
                  onPickDay={nav.goTo}
                  onSelect={select}
                  onReview={() => dialogs.show('review')}
                  onReschedule={
                    canEdit && weekStart + 7 * DAY > (today ?? weekStart)
                      ? () => setReschedule({ from: ymd(Math.max(weekStart, today ?? weekStart)) })
                      : undefined
                  }
                  onPickWeek={(monday) =>
                    onSearchChange({
                      week: ymd(monday),
                      day: undefined,
                      view: view === 'week' || view === 'month' ? view : 'week',
                    })
                  }
                />
              </div>
            )}
          </aside>
        )}
      </div>

      <EventDialog
        plan={wholePlan}
        event={selected}
        day={pickedDay}
        onDayChange={setPickedDay}
        draft={drafting.draft}
        edited={selected !== null && session.edited.has(selected.uid)}
        canEdit={canEdit}
        onChange={session.change}
        onClose={() => {
          drafting.clear()
          if (search.event) onSearchChange({ event: undefined })
        }}
        onDraftChange={drafting.show}
        busy={taken.blocks}
        anchor={dialogAnchor}
        onFocus={onFocus}
      />
      <CalendarsDialog
        plan={wholePlan}
        open={dialogs.isOpen('calendars')}
        onChange={session.change}
        undo={quiet.lastStep}
        trashCount={trashCount}
        onOpenTrash={() => {
          dialogs.hide('calendars')
          dialogs.show('trash')
        }}
        onNewCourse={() => {
          dialogs.hide('calendars')
          dialogs.show('course')
        }}
        onClose={() => dialogs.hide('calendars')}
      />
      <NewCourseDialog
        plan={wholePlan}
        now={now}
        open={canEdit && dialogs.isOpen('course')}
        onApply={session.changeAll}
        onAdded={(start) => nav.goTo(parseLocal(start))}
        onClose={() => dialogs.hide('course')}
      />
      <CountdownDialog
        plan={plan}
        now={now}
        open={dialogs.isOpen('countdown')}
        onApply={session.changeAll}
        onClose={() => dialogs.hide('countdown')}
      />
      <SettingsDialog
        plan={wholePlan}
        open={dialogs.isOpen('settings')}
        onApply={canEdit ? session.changeAll : undefined}
        reminder={reminders.supported ? reminders : undefined}
        onClose={() => dialogs.hide('settings')}
      />
      <RescheduleDialog
        plan={wholePlan}
        from={reschedule?.from ?? null}
        preset={reschedule?.preset}
        onApply={session.changeAll}
        rebalance={rebalance}
        onClose={() => {
          setReschedule(null)
          if (search.reschedule) onSearchChange({ reschedule: undefined, calendar: undefined })
        }}
      />
      <WeekReviewDialog
        plan={plan}
        monday={reviewMonday ?? (dialogs.isOpen('review') ? weekStart : null)}
        now={now}
        onCatchUp={canEdit ? () => dialogs.show('catchUp') : undefined}
        onNextWeek={() => nav.showWeek((reviewMonday ?? weekStart) + 7 * DAY)}
        actions={sessionActions}
        onChange={canEdit ? session.change : undefined}
        onClose={() => {
          setReviewMonday(null)
          dialogs.hide('review')
        }}
      />
      <ResizedDoneDialog resized={resized} onChange={session.change} onClose={() => setResized(null)} />
      <LogDoneDialog
        plan={wholePlan}
        uids={logDone}
        onChange={session.change}
        onClose={() => {
          setLogDone([])
          if (search.fill) onSearchChange({ fill: undefined })
        }}
      />
      <CatchUpDialog
        plan={wholePlan}
        open={dialogs.isOpen('catchUp')}
        now={now}
        onChange={session.change}
        onShift={() => setReschedule({ from: (overdue[0]?.start ?? ymd(today ?? weekStart)).slice(0, 10) })}
        onClose={() => {
          dialogs.hide('catchUp')
          if (search.open) onSearchChange({ open: undefined })
        }}
      />
      <TrashDialog
        plan={wholePlan}
        trash={session.trash}
        open={dialogs.isOpen('trash')}
        onChange={session.change}
        onClose={() => dialogs.hide('trash')}
      />
      <HistoryDialog
        open={dialogs.isOpen('history')}
        history={session.history}
        mod={mod}
        now={now}
        onTravel={session.travel}
        onTrim={session.trimHistory}
        onClose={() => dialogs.hide('history')}
      />
      <SecondZoneDialog
        open={dialogs.isOpen('zone')}
        zone={zone}
        now={now}
        onChoose={setZone}
        onClose={() => dialogs.hide('zone')}
      />
      <BusyFeedDialog
        open={dialogs.isOpen('busy')}
        host={busy?.host ?? null}
        onSave={busy?.save}
        onClose={() => dialogs.hide('busy')}
      />
      <PlanFileReader
        open={dialogs.isOpen('planFile')}
        shown={{ name: session.file?.name ?? planFileName(wholePlan), plan: wholePlan }}
        project={hostPlan.view.plan}
        onOpen={(file) => {
          session.openFile(file.name, file.plan, file.origin)
          reset()
          onSearchChange({ week: undefined, event: undefined })
        }}
        library={library}
        origin={session.file?.origin}
        now={now}
        onApply={canEdit ? session.changeAll : undefined}
        onClose={() => dialogs.hide('planFile')}
      />
      <IntegrationsDialog
        open={dialogs.isOpen('integrations')}
        apps={apps.statuses}
        working={apps.working}
        busy={busyAction}
        onExport={renderExport && (() => dialogs.show('export'))}
        onApp={(provider) => {
          setShownApp(provider)
          dialogs.show('sync')
        }}
        onReview={() => dialogs.show('syncReview')}
        onBusy={() => dialogs.show('busy')}
        onClose={() => dialogs.hide('integrations')}
      />
      {renderExport?.({
        plan: wholePlan,
        hidden: exportHidden,
        open: dialogs.isOpen('export'),
        onClose: () => dialogs.hide('export'),
      })}
      {shownSource && shownStatus && (
        <CalendarSyncDialog
          // Each app's form starts empty.
          key={shownStatus.provider}
          open={dialogs.isOpen('sync')}
          status={shownStatus}
          connectUrl={shownSource.connectUrl}
          callbackPath={shownSource.callbackPath}
          ended={search.link === shownStatus.provider ? (search.signin ?? null) : null}
          working={apps.working(shownStatus.provider)}
          error={apps.error(shownStatus.provider)}
          onSaveClient={shownSource.saveClient}
          onSync={() => apps.sync(shownStatus.provider)}
          onDisconnect={shownSource.disconnect}
          onClose={() => {
            dialogs.hide('sync')
            if (search.link) onSearchChange({ link: undefined, signin: undefined })
          }}
        />
      )}
      <CalendarReviewDialog
        open={dialogs.isOpen('syncReview') && apps.held.length > 0}
        plan={wholePlan}
        items={apps.held}
        working={apps.working()}
        error={apps.error()}
        onAccept={apps.accept}
        onKeep={apps.reject}
        onClose={() => dialogs.hide('syncReview')}
      />
      <CommandPalette
        open={dialogs.isOpen('palette')}
        plan={plan}
        commands={palette}
        onSelectEvent={select}
        now={now}
        onQuickAdd={
          canEdit
            ? (quick) => {
                nav.goTo(parseLocal(quick.start))
                drafting.begin(quick.start, quick.end, quick.title)
              }
            : undefined
        }
        onClose={() => dialogs.hide('palette')}
      />
      <ShortcutsDialog
        open={dialogs.isOpen('shortcuts')}
        rows={[
          { keys: `${mod} K`, label: m.search() },
          ...(canEdit
            ? [
                { keys: `${mod} Z`, label: m.undo() },
                { keys: `${mod} ⇧ Z`, label: m.redo() },
              ]
            : []),
          ...toShortcutRows(actions),
          ...(canEdit
            ? [
                { keys: 'Alt ← ↑ ↓ →', label: m.shortcut_move_event() },
                { keys: 'Alt Shift ↑ ↓', label: m.shortcut_resize_event() },
                { keys: 'Delete', label: m.shortcut_delete_event() },
              ]
            : []),
        ]}
        onClose={() => dialogs.hide('shortcuts')}
      />
    </div>
  )
}
