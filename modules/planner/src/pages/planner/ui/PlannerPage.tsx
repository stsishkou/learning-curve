import { m } from '@lc/i18n/messages'
import {
  DAY,
  isSession,
  mondayOf,
  moveOccurrence,
  occurrences,
  parseLocal,
  planFileName,
  planStart,
  removeOccurrence,
  startOfDay,
  ymd,
  type Occurrence,
  type Plan,
  type PlanChange,
  type PlanEvent,
} from '@lc/plan-domain'
import { useMemo, useState, type ReactNode } from 'react'

import { CatchUpDialog } from '../../../features/catch-up'
import { CommandPalette, type Command } from '../../../features/command-palette'
import { EventDialog } from '../../../features/edit-event'
import { CalendarFilter, useHiddenCalendars } from '../../../features/filter-calendars'
import { HistoryDialog } from '../../../features/history'
import { ShortcutsDialog, useShortcuts } from '../../../features/keyboard-shortcuts'
import { CalendarsDialog } from '../../../features/manage-calendars'
import { FileBanner, OpenPlanFile } from '../../../features/open-plan-file'
import { ShiftDialog } from '../../../features/shift-plan'
import { TrashDialog } from '../../../features/trash'
import { WeekReviewDialog } from '../../../features/week-review'
import { eventKey, useModKey, useNow } from '../../../shared/lib'
import { AgendaList } from '../../../widgets/agenda-list'
import { MonthGrid } from '../../../widgets/month-grid'
import { NowNext } from '../../../widgets/now-next'
import { Runway } from '../../../widgets/runway'
import { WeekGrid } from '../../../widgets/week-grid'
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
  /** Shown next to the title: controls the host owns, such as the language switcher */
  headerAside?: ReactNode
  /** More header actions that work on the plan as it is shown now, such as export */
  renderActions?: (shown: { plan: Plan; hidden: ReadonlySet<string> }) => ReactNode
  /** Host actions listed in the command palette, such as the theme */
  commands?: Command[]
}

const NO_CALENDARS: ReadonlySet<string> = new Set()

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
  headerAside,
  renderActions,
  commands,
}: Props) {
  const now = useNow()
  const mod = useModKey()
  const { hidden, toggle, solo, showAll, reset } = useHiddenCalendars()
  const session = usePlanSession(state, { onChange, onTravel })
  const { plan, canEdit } = session
  const nav = usePlannerView(plan, search, onSearchChange)
  const { view, expanded, weekStart } = nav
  const quiet = useQuietChange(session)
  const dialogs = useDialogFlags<DialogName>()
  const drafting = useEventDraft({ plan, hidden, now, weekStart, canEdit })

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
  const monthItems =
    view === 'month' ? occurrences(plan, nav.monthGridStart, nav.monthGridStart + nav.monthWeeks * 7 * DAY, hidden) : []
  const allItems = useMemo(
    () => (view === 'list' ? occurrences(plan, planStart(plan), parseLocal(plan.meta.planEnd) + 8 * DAY, hidden) : []),
    [plan, hidden, view],
  )
  const today = now === null ? null : startOfDay(now)
  const upcoming = useMemo(
    () => (today === null ? [] : occurrences(plan, today, today + 21 * DAY, NO_CALENDARS).filter((o) => !o.allDay)),
    [plan, today],
  )

  // Sessions that should be over and are not marked done: the plan and the reality have drifted apart.
  const overdue = useMemo(
    () => (now === null ? [] : plan.events.filter((e) => isSession(e) && !e.done && parseLocal(e.end) < now)),
    [plan, now],
  )

  // One repeat of a series, not all of them: the one that was opened, or the first on screen after a reload.
  const selectedShown = selected
    ? (view === 'month' ? monthItems : weekItems).find(
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
            <OpenPlanFile
              shown={{ name: session.file?.name ?? planFileName(plan), plan }}
              project={state.plan}
              onOpen={(file) => {
                session.openFile(file.name, file.plan)
                reset()
                onSearchChange({ week: undefined, event: undefined })
              }}
            />
            {renderActions?.({ plan, hidden })}
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
      >
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

      {quiet.saveError && (
        <p className="mb-3 text-[13px] text-today-ink" role="alert">
          {quiet.saveError}
        </p>
      )}
      {quiet.lastStep && (
        <UndoBar
          label={quiet.lastStep.label}
          onUndo={quiet.undo}
          onHistory={() => dialogs.show('history')}
          onDismiss={session.dismissLastStep}
        />
      )}

      <div className={`grid grid-cols-1 items-start gap-4 ${expanded ? '' : 'lg:grid-cols-[1fr_280px]'}`}>
        <section className="min-w-0 rounded-2xl border border-line bg-surface">
          {view === 'week' && (
            <WeekGrid
              plan={plan}
              weekStart={weekStart}
              fullDay={nav.fullDay}
              items={weekItems}
              now={now}
              onSelect={select}
              onMove={canEdit ? (o, slot) => quiet.change(moveOccurrence(o, slot)) : undefined}
              onRemove={canEdit ? (o) => quiet.change(removeOccurrence(o)) : undefined}
              onCreate={canEdit ? drafting.begin : undefined}
              draft={drafting.slot}
              selectedKey={selectedKey}
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
              onPickDay={(day) => onSearchChange({ view: 'week', week: ymd(mondayOf(day)) })}
              onMove={canEdit ? (o, slot) => quiet.change(moveOccurrence(o, slot)) : undefined}
            />
          )}
          {view === 'list' && <AgendaList plan={plan} items={allItems} now={now} onSelect={select} />}
        </section>
        {!expanded && (
          // The list is long: on one column the side panel goes above it instead of far below.
          <aside className={`grid min-w-0 gap-4 ${view === 'list' ? 'order-first lg:order-none' : ''}`}>
            <NowNext plan={plan} upcoming={upcoming} now={now} onSelect={select} />
            <InsightTabs
              plan={plan}
              weekItems={weekItems}
              hidden={hidden}
              now={now}
              weekStart={weekStart}
              onSelect={select}
              onReview={() => dialogs.show('review')}
              onPickWeek={(monday) => onSearchChange({ week: ymd(monday), view: view === 'list' ? 'week' : view })}
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
        anchor={dialogAnchor}
      />
      <CalendarsDialog
        plan={plan}
        open={dialogs.isOpen('calendars')}
        onChange={session.change}
        undo={quiet.lastStep}
        trashCount={trashCount}
        onOpenTrash={() => (dialogs.hide('calendars'), dialogs.show('trash'))}
        onClose={() => dialogs.hide('calendars')}
      />
      <ShiftDialog plan={plan} from={shiftFrom} onChange={session.change} onClose={() => setShiftFrom(null)} />
      <WeekReviewDialog
        plan={plan}
        monday={dialogs.isOpen('review') ? weekStart : null}
        now={now}
        onCatchUp={canEdit ? () => dialogs.show('catchUp') : undefined}
        onNextWeek={() => nav.setWeek(weekStart + 7 * DAY)}
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
      <CommandPalette
        open={dialogs.isOpen('palette')}
        plan={plan}
        commands={palette}
        onSelectEvent={select}
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
