import { m } from '@lc/i18n/messages'
import {
  DAY,
  HOUR,
  isSession,
  mondayOf,
  moveOccurrence,
  occurrences,
  parseLocal,
  planFileName,
  planStart,
  removeOccurrence,
  reviewOffers,
  startOfDay,
  toLocalString,
  ymd,
  zoneShift,
  type CalendarProvider,
  type HistoryStep,
  type Occurrence,
  type Plan,
  type PlanChange,
  type PlanEvent,
} from '@lc/plan-domain'
import { Button, CalendarSync, HelpToggle, Hint, useHelpMode } from '@lc/ui'
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
import { CalendarFilter, useHiddenCalendars } from '../../../features/filter-calendars'
import { describeStep, HistoryDialog } from '../../../features/history'
import { ShortcutsDialog, useShortcuts } from '../../../features/keyboard-shortcuts'
import { CalendarsDialog } from '../../../features/manage-calendars'
import { FileBanner, OpenPlanFile, type PlanLibrary } from '../../../features/open-plan-file'
import { ReviewBar, useDismissedReviews } from '../../../features/plan-reviews'
import { useReminders } from '../../../features/reminders'
import { SecondZoneDialog, useSecondZone } from '../../../features/second-zone'
import { ShiftDialog } from '../../../features/shift-plan'
import { TrashDialog } from '../../../features/trash'
import { WeekReviewDialog } from '../../../features/week-review'
import { appName, eventKey, useModKey, useNow } from '../../../shared/lib'
import { AgendaList } from '../../../widgets/agenda-list'
import { BudgetLine } from '../../../widgets/budget-panel'
import { MonthGrid } from '../../../widgets/month-grid'
import { NowNext } from '../../../widgets/now-next'
import { Runway } from '../../../widgets/runway'
import { WeekGrid } from '../../../widgets/week-grid'
import { YearGrid } from '../../../widgets/year-grid'
import { buildActions, type DialogName } from '../model/build-actions'
import { toCommands, toMenuItems, toShortcutRows, toShortcuts } from '../model/planner-actions'
import type { PlannerSearch } from '../model/search'
import { useDialogFlags } from '../model/use-dialog-flags'
import { useEventDraft } from '../model/use-event-draft'
import { usePlanSession, type PlannerState } from '../model/use-plan-session'
import { usePlannerView } from '../model/use-planner-view'
import { useQuietChange } from '../model/use-quiet-change'
import { InsightTabs } from './InsightTabs'
import { OverdueBar } from './OverdueBar'
import { PlannerHeader } from './PlannerHeader'
import { PlannerToolbar } from './PlannerToolbar'
import { UndoBar } from './UndoBar'

interface Props {
  /** The plan with what the host knows about it: `{ plan, canEdit, edited, trash, history }` */
  state: PlannerState
  /** The part of the view kept in the URL: the week, the view, the open event */
  search: PlannerSearch
  /** Merges the given keys into the URL; `undefined` removes a key. */
  onSearchChange: (patch: PlannerSearch) => void
  /** Stores one change. Resolves once `state` is fresh; rejects with the reason. */
  onChange: (change: PlanChange) => Promise<void>
  /** Moves the plan to a point of its history: 0 is before the first change. Resolves once `state` is fresh. */
  onTravel: (cursor: number) => Promise<void>
  /** Stores the changes of an update in order, all or none. Without it they are sent to `onChange` one by one */
  onChangeAll?: (changes: PlanChange[]) => Promise<void>
  /** Present when the host keeps plan files with versions: the plan file reader lists them */
  library?: PlanLibrary | undefined
  /** Shown next to the title: controls the host owns, such as the language switcher */
  headerAside?: ReactNode
  /** More header actions that work on the plan as it is shown now, such as export */
  renderActions?: (shown: { plan: Plan; hidden: ReadonlySet<string> }) => ReactNode
  /** Present when the host has a focus page: called with the uid of the session to time there */
  onFocus?: (uid: string) => void
  /** Present when the host can read the person's own calendar: its busy time is drawn behind the plan */
  busy?: BusySource
  /** The calendar apps the host can keep the plan in and read edits made there back from; absent where it cannot */
  sync?: CalendarSyncSource[] | undefined
  /** The export dialog, from the module that writes the files: the calendar integrations offer it when present */
  renderExport?:
    | ((dialog: { plan: Plan; hidden: ReadonlySet<string>; open: boolean; onClose: () => void }) => ReactNode)
    | undefined
  /** Host actions listed in the command palette, such as the theme */
  commands?: Command[]
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
export function PlannerPage({
  state,
  search,
  onSearchChange,
  onChange,
  onTravel,
  onChangeAll,
  library,
  headerAside,
  renderActions,
  onFocus,
  busy,
  sync,
  renderExport,
  commands,
}: Props) {
  const now = useNow()
  const mod = useModKey()
  const { hidden, toggle, solo, showAll, reset } = useHiddenCalendars()
  const session = usePlanSession(state, { onChange, onTravel, onChangeAll })
  const { plan, canEdit } = session
  const nav = usePlannerView(plan, search, onSearchChange)
  const { view, expanded, weekStart } = nav
  const quiet = useQuietChange(session)
  // A sign-in to a calendar app comes back to the page with its outcome: that app's dialog shows how it went.
  const dialogs = useDialogFlags<DialogName>(search.link ? ['sync'] : [])
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

  const [shiftFrom, setShiftFrom] = useState<string | null>(null)
  const [overdueHidden, setOverdueHidden] = useState(false)
  // Which repeat of a repeating event was opened, `YYYY-MM-DD`: the URL only names the series.
  const [pickedDay, setPickedDay] = useState<string | null>(null)

  const selected = plan.events.find((e) => e.uid === search.event) ?? null
  const select = (e: PlanEvent | Occurrence) => {
    setPickedDay('s' in e ? ymd(e.s) : null)
    onSearchChange({ event: e.uid })
  }
  const trashCount = session.trash.events.length + session.trash.calendars.length

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

  const only = (id: string) =>
    solo(
      id,
      plan.calendars.map((c) => c.id),
    )
  const shift = () => setShiftFrom(ymd(today ?? weekStart))

  const { cursor, steps } = session.history
  const actions = buildActions({
    nav,
    canEdit,
    calendars: plan.calendars,
    hiddenCount: hidden.size,
    history: { cursor, total: steps.length, ...quiet },
    secondZone: secondZone?.label,
    integrations: { waiting: apps.held.length },
    reminders: reminders.supported ? reminders : undefined,
    help: { on: helpOn, toggle: toggleHelp },
    trashCount,
    overdueCount: overdue.length,
    open: dialogs.show,
    newEvent: () => drafting.begin(),
    shift,
    only,
    showAll,
  })
  const palette: Command[] = [...toCommands(actions), ...(commands ?? [])]

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
          <PlannerHeader
            plan={plan}
            onRename={canEdit ? (title) => quiet.change({ type: 'plan.rename', title }) : undefined}
            aside={headerAside}
          >
            {/* On a phone the two plan buttons fill the row: the switch is in the menu there. */}
            <HelpToggle label={m.help_toggle()} className="max-md:hidden" />
            <Hint title={m.help_file_title()} text={m.help_file()} className="self-center max-md:hidden" />
            <OpenPlanFile
              shown={{ name: session.file?.name ?? planFileName(plan), plan, origin: session.file?.origin }}
              project={state.plan}
              onOpen={(file) => {
                session.openFile(file.name, file.plan, file.origin)
                reset()
                onSearchChange({ week: undefined, event: undefined })
              }}
              library={library}
              now={now}
              onApply={canEdit ? session.changeAll : undefined}
            />
            {renderActions?.({ plan, hidden })}
            <Button
              className="relative flex items-center justify-center gap-1.5"
              onClick={() => dialogs.show('integrations')}
            >
              <CalendarSync size={16} aria-hidden /> {m.integrations()}
              {attention && (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-bg bg-today"
                />
              )}
            </Button>
          </PlannerHeader>

          <Runway plan={plan} now={now} onSelect={select} />
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
        summary={expanded && view === 'week' && <BudgetLine plan={plan} weekItems={weekItems} />}
      >
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
          onMarkDone={() => quiet.change({ type: 'events.done', uids: overdue.map((e) => e.uid), done: true })}
          onCatchUp={() => dialogs.show('catchUp')}
          onDismiss={() => setOverdueHidden(true)}
        />
      )}

      {canEdit && !overdueHidden && (view === 'week' || view === 'day') && (
        <Backlog plan={plan} events={overdue} onSelect={select} onCarry={setCarried} />
      )}

      {canEdit && apps.held.length > 0 && (
        <CalendarReviewBar count={apps.held.length} onReview={() => dialogs.show('syncReview')} />
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
            onUndo={quiet.undo}
            onHistory={() => dialogs.show('history')}
            onDismiss={session.dismissLastStep}
          />
        )
      )}

      <div className={`grid grid-cols-1 items-start gap-4 ${expanded ? '' : 'lg:grid-cols-[1fr_280px]'}`}>
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
              onMove={canEdit ? (o, slot) => quiet.change(moveOccurrence(o, slot)) : undefined}
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
            />
          )}
        </section>
        {!expanded && (
          // The list is long: on one column the side panel goes above it instead of far below.
          <aside className={`grid min-w-0 gap-4 print:hidden ${view === 'list' ? 'order-first lg:order-none' : ''}`}>
            <NowNext plan={plan} upcoming={upcoming} now={now} onSelect={select} onFocus={onFocus} />
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
              onPickWeek={(monday) =>
                onSearchChange({
                  week: ymd(monday),
                  day: undefined,
                  view: view === 'week' || view === 'month' ? view : 'week',
                })
              }
            />
          </aside>
        )}
      </div>

      <EventDialog
        plan={plan}
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
      />
      <CalendarsDialog
        plan={plan}
        open={dialogs.isOpen('calendars')}
        onChange={session.change}
        undo={quiet.lastStep}
        trashCount={trashCount}
        onOpenTrash={() => {
          dialogs.hide('calendars')
          dialogs.show('trash')
        }}
        onClose={() => dialogs.hide('calendars')}
      />
      <ShiftDialog plan={plan} from={shiftFrom} onChange={session.change} onClose={() => setShiftFrom(null)} />
      <WeekReviewDialog
        plan={plan}
        monday={dialogs.isOpen('review') ? weekStart : null}
        now={now}
        onCatchUp={canEdit ? () => dialogs.show('catchUp') : undefined}
        onNextWeek={() => nav.showWeek(weekStart + 7 * DAY)}
        onClose={() => dialogs.hide('review')}
      />
      <CatchUpDialog
        plan={plan}
        open={dialogs.isOpen('catchUp')}
        now={now}
        onChange={session.change}
        onShift={() => setShiftFrom((overdue[0]?.start ?? ymd(today ?? weekStart)).slice(0, 10))}
        onClose={() => dialogs.hide('catchUp')}
      />
      <TrashDialog
        plan={plan}
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
      {renderExport?.({ plan, hidden, open: dialogs.isOpen('export'), onClose: () => dialogs.hide('export') })}
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
        plan={plan}
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
