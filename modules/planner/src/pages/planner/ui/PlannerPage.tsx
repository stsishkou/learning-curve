import { fmtDay, fmtMonth, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  DAY,
  HOUR,
  isSession,
  mondayOf,
  movePatch,
  nowMinsk,
  occurrences,
  parseLocal,
  planStart,
  startOfDay,
  startOfMonth,
  toLocalString,
  ymd,
  type NewEvent,
  type Occurrence,
  type Plan,
  type PlanChange,
  type PlanEvent,
} from '@lc/plan-domain'
import { Button, Kbd, Menu, Segmented, type MenuItem } from '@lc/ui'
import { useMemo, useRef, useState, type ReactNode } from 'react'

import { CommandPalette, type Command } from '../../../features/command-palette'
import { EventDialog } from '../../../features/edit-event'
import { CalendarFilter, useHiddenCalendars } from '../../../features/filter-calendars'
import { describeStep, HistoryDialog } from '../../../features/history'
import { ShortcutsDialog, useShortcuts } from '../../../features/keyboard-shortcuts'
import { CalendarsDialog } from '../../../features/manage-calendars'
import { FileBanner, OpenPlanFile } from '../../../features/open-plan-file'
import { ShiftDialog } from '../../../features/shift-plan'
import { TrashDialog } from '../../../features/trash'
import { useModKey, useNow } from '../../../shared/lib'
import { AgendaList } from '../../../widgets/agenda-list'
import { MonthGrid } from '../../../widgets/month-grid'
import { NowNext } from '../../../widgets/now-next'
import { Runway } from '../../../widgets/runway'
import { WeekGrid } from '../../../widgets/week-grid'
import type { PlannerSearch, PlannerView } from '../model/search'
import { usePlanSession, type PlannerState } from '../model/use-plan-session'
import { InsightTabs } from './InsightTabs'

interface Props {
  state: PlannerState
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

const PRESSED = 'aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'
const STEP =
  'grid size-9 place-items-center rounded-[10px] border border-line bg-surface whitespace-nowrap disabled:opacity-40'
const NO_CALENDARS: ReadonlySet<string> = new Set()

function defaultWeek(plan: Plan) {
  const now = nowMinsk()
  const first = planStart(plan)
  return mondayOf(now < first ? first : now)
}

/** The first Monday of a month: its Thursday is always inside that month. */
const firstWeekOf = (month: number) => mondayOf(month + 6 * DAY)

const errorText = (err: unknown) => m.save_failed({ reason: err instanceof Error ? err.message : String(err) })

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
  const { hidden, toggle, solo, reset } = useHiddenCalendars()
  const session = usePlanSession(state, { onChange, onTravel })
  const { plan, canEdit } = session

  const [draft, setDraft] = useState<NewEvent | null>(null)
  const [calendarsOpen, setCalendarsOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [shiftFrom, setShiftFrom] = useState<string | null>(null)
  const [overdueHidden, setOverdueHidden] = useState(false)
  const datePicker = useRef<HTMLInputElement>(null)
  // Which repeat of a repeating event was opened, `YYYY-MM-DD`: the URL only names the series.
  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [saveError, setSaveError] = useState('')

  const selected = plan.events.find((e) => e.uid === search.event) ?? null
  const select = (e: PlanEvent | Occurrence) => {
    setPickedDay('s' in e ? ymd(e.s) : null)
    onSearchChange({ event: e.uid })
  }
  const trashCount = session.trash.events.length + session.trash.calendars.length

  const view: PlannerView = search.view ?? 'week'
  const expanded = search.expanded === true
  const weekStart = search.week ? mondayOf(parseLocal(search.week)) : defaultWeek(plan)
  const setWeek = (t: number) => onSearchChange({ week: ymd(t) })

  // The month a week belongs to is the month of its Thursday, so a week that straddles two months is not lost.
  const monthStart = startOfMonth(weekStart + 3 * DAY)
  const monthGridStart = mondayOf(monthStart)
  const monthWeeks = Math.ceil((startOfMonth(monthStart, 1) - monthGridStart) / (7 * DAY))
  const step = (direction: 1 | -1) =>
    setWeek(view === 'month' ? firstWeekOf(startOfMonth(monthStart, direction)) : weekStart + direction * 7 * DAY)

  const weekItems = useMemo(() => occurrences(plan, weekStart, weekStart + 7 * DAY, hidden), [plan, weekStart, hidden])
  const monthItems =
    view === 'month' ? occurrences(plan, monthGridStart, monthGridStart + monthWeeks * 7 * DAY, hidden) : []
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

  /** A change made outside a dialog (a drag, an undo): its failure is shown above the calendar. */
  async function changeQuietly(change: PlanChange) {
    try {
      await session.change(change)
      setSaveError('')
    } catch (err) {
      setSaveError(errorText(err))
    }
  }

  const { cursor, steps } = session.history
  const canUndo = canEdit && cursor > 0
  const canRedo = canEdit && cursor < steps.length
  /** One step back or forward; its failure is shown above the calendar. */
  const timeTravel = (to: number) =>
    void session
      .travel(to)
      .then(() => setSaveError(''))
      .catch((err: unknown) => setSaveError(errorText(err)))
  const undo = () => canUndo && timeTravel(cursor - 1)
  const redo = () => canRedo && timeTravel(cursor + 1)
  const lastStep = session.lastStep && {
    label: describeStep(session.lastStep),
    run: () => session.travel(cursor - 1),
  }

  const move = (o: Occurrence, slot: { s: number; e: number }) =>
    void changeQuietly({ type: 'event.patch', uid: o.uid, patch: movePatch(o, o.s, slot.s, slot.e) })
  /** Delete on a focused event: one repeat of a series is skipped, anything else goes to the trash. */
  const remove = (o: Occurrence) =>
    void changeQuietly(
      o.rrule
        ? { type: 'event.patch', uid: o.uid, patch: { skip: [...(o.skip ?? []), ymd(o.s)] } }
        : { type: 'event.remove', uid: o.uid },
    )

  function newEvent(start?: string) {
    if (!canEdit) return
    // Without a slot: the next full hour when today is on screen, otherwise noon of the first visible day.
    const inWeek = now !== null && now >= weekStart && now < weekStart + 7 * DAY
    const begin = start ? parseLocal(start) : inWeek ? Math.ceil(now / HOUR) * HOUR : weekStart + 12 * HOUR
    const calendar = plan.calendars.find((c) => !hidden.has(c.id)) ?? plan.calendars[0]
    if (!calendar) return
    setDraft({
      calendar: calendar.id,
      title: '',
      description: '',
      start: toLocalString(begin),
      end: toLocalString(begin + HOUR),
      availability: 'busy',
    })
  }

  const go = {
    today: () => onSearchChange({ week: undefined }),
    view: (next: PlannerView) => onSearchChange({ view: next }),
    fullDay: () => onSearchChange({ fullDay: search.fullDay ? undefined : true }),
    expand: () => onSearchChange({ expanded: expanded ? undefined : true }),
  }

  const actions: Command[] = [
    { id: 'today', group: m.palette_navigate(), label: m.go_today(), keys: 'T', run: go.today },
    { id: 'previous', group: m.palette_navigate(), label: m.previous_period(), keys: '←', run: () => step(-1) },
    { id: 'next', group: m.palette_navigate(), label: m.next_period(), keys: '→', run: () => step(1) },
    { id: 'week', group: m.view(), label: m.view_week(), keys: 'W', run: () => go.view('week') },
    { id: 'month', group: m.view(), label: m.view_month(), keys: 'M', run: () => go.view('month') },
    { id: 'list', group: m.view(), label: m.view_list(), keys: 'L', run: () => go.view('list') },
    { id: 'full-day', group: m.view(), label: m.full_day_hint(), keys: 'F', run: go.fullDay },
    { id: 'expand', group: m.view(), label: expanded ? m.collapse() : m.expand_hint(), keys: 'E', run: go.expand },
    ...(canEdit
      ? [
          { id: 'new-event', group: m.palette_plan(), label: m.new_event(), keys: 'N', run: () => newEvent() },
          {
            id: 'calendars',
            group: m.palette_plan(),
            label: m.manage_calendars(),
            keys: 'C',
            run: () => setCalendarsOpen(true),
          },
          { id: 'trash', group: m.palette_plan(), label: m.trash(), run: () => setTrashOpen(true) },
          {
            id: 'shift',
            group: m.palette_plan(),
            label: m.shift_plan(),
            run: () => setShiftFrom(ymd(today ?? weekStart)),
          },
          { id: 'history', group: m.palette_plan(), label: m.history(), keys: 'H', run: () => setHistoryOpen(true) },
          { id: 'undo', group: m.palette_plan(), label: m.undo(), run: undo },
          { id: 'redo', group: m.palette_plan(), label: m.redo(), run: redo },
        ]
      : []),
    { id: 'shortcuts', group: m.palette_plan(), label: m.shortcuts(), keys: '?', run: () => setShortcutsOpen(true) },
    ...(commands ?? []),
  ]

  const narrow = 'md:hidden'
  const menu: MenuItem[] = [
    { id: 'search', label: m.search(), className: narrow, run: () => setPaletteOpen(true) },
    ...(canEdit
      ? [
          { id: 'undo', label: m.undo(), className: narrow, disabled: !canUndo, run: () => void undo() },
          { id: 'redo', label: m.redo(), className: narrow, disabled: !canRedo, run: () => void redo() },
        ]
      : []),
    ...(view === 'week'
      ? [{ id: 'full-day', label: m.full_day(), className: narrow, checked: search.fullDay === true, run: go.fullDay }]
      : []),
    { id: 'expand', label: m.expand(), className: narrow, checked: expanded, run: go.expand },
    ...(canEdit
      ? [
          {
            id: 'history',
            label: m.history(),
            keys: 'H',
            badge: steps.length ? `${cursor}/${steps.length}` : undefined,
            run: () => setHistoryOpen(true),
          },
          { id: 'trash', label: m.trash(), badge: trashCount || undefined, run: () => setTrashOpen(true) },
          { id: 'shift', label: m.shift_plan(), run: () => setShiftFrom(ymd(today ?? weekStart)) },
          { id: 'calendars', label: m.manage_calendars(), keys: 'C', run: () => setCalendarsOpen(true) },
        ]
      : []),
    { id: 'shortcuts', label: m.shortcuts(), keys: '?', run: () => setShortcutsOpen(true) },
  ]

  useShortcuts({
    'mod+k': () => setPaletteOpen(true),
    '/': () => setPaletteOpen(true),
    ...Object.fromEntries(actions.flatMap((a) => (a.keys ? [[a.keys.toLowerCase(), a.run]] : []))),
    'mod+z': undo,
    'mod+shift+z': redo,
    arrowleft: () => step(-1),
    arrowright: () => step(1),
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
          <header className="flex flex-col gap-3 md:flex-row md:items-end md:gap-2">
            <div className="min-w-0 md:mr-auto">
              <h1 className="text-[22px]/[1.2] font-semibold tracking-[-0.01em]">{plan.meta.title}</h1>
              <p className="mt-1 text-[14px] text-muted">
                {m.plan_summary({
                  events: m.events_count({ count: plan.events.length }),
                  calendars: m.in_calendars({ count: plan.calendars.length }),
                  date: fmtDay(parseLocal(plan.meta.planEnd)),
                })}
              </p>
            </div>
            {/* On a narrow screen the sections of the app come first, as a bar above the title. */}
            <div className="order-first md:order-none">{headerAside}</div>
            <div className="flex gap-2 *:flex-1 md:*:flex-none">
              <OpenPlanFile
                shown={{ name: session.file?.name ?? 'plan.json', plan }}
                project={state.plan}
                onOpen={(file) => {
                  session.openFile(file.name, file.plan)
                  reset()
                  onSearchChange({ week: undefined, event: undefined })
                }}
              />
              {renderActions?.({ plan, hidden })}
            </div>
          </header>

          <Runway plan={plan} now={now} onSelect={select} />
        </>
      )}

      {/* The single column may not grow with its content: the calendar chips scroll inside their row instead. */}
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)] gap-2.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          <Segmented
            label={m.view()}
            value={view}
            options={[
              { value: 'week', label: m.view_week() },
              { value: 'month', label: m.view_month() },
              { value: 'list', label: m.view_list() },
            ]}
            onChange={go.view}
          />
          {view !== 'list' && (
            <div
              role="group"
              aria-label={m.palette_navigate()}
              className="order-last flex w-full items-center gap-1.5 md:order-none md:w-auto"
            >
              <button type="button" className={STEP} aria-label={m.previous_period()} onClick={() => step(-1)}>
                ‹
              </button>
              <h2 className="relative mx-0.5 flex-1 text-center md:min-w-[170px] md:flex-none">
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-1.5 text-[14px]/[1.2] font-semibold whitespace-nowrap hover:bg-surface-2 md:text-[16px]/[1.2]"
                  title={m.jump_to_date()}
                  onClick={() => datePicker.current?.showPicker()}
                >
                  {view === 'month'
                    ? fmtMonth(monthStart)
                    : `${fmtShort(weekStart)} – ${fmtShort(weekStart + 6 * DAY)} ${new Date(weekStart + 6 * DAY).getUTCFullYear()}`}
                </button>
                {/* The native date picker opens from the title; the field itself stays out of sight and out of the tab order. */}
                <input
                  ref={datePicker}
                  type="date"
                  tabIndex={-1}
                  aria-label={m.jump_to_date()}
                  className="pointer-events-none absolute bottom-0 left-1/2 size-px opacity-0"
                  value={ymd(weekStart)}
                  onChange={(e) => e.target.value && setWeek(mondayOf(parseLocal(`${e.target.value}T00:00`)))}
                />
              </h2>
              <button type="button" className={STEP} aria-label={m.next_period()} onClick={() => step(1)}>
                ›
              </button>
              <Button onClick={go.today}>{m.go_today()}</Button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Button className="hidden items-center gap-2 text-muted md:flex" onClick={() => setPaletteOpen(true)}>
              {m.search()} <Kbd>{mod} K</Kbd>
            </Button>
            {canEdit && (
              <div role="group" aria-label={m.history()} className="hidden gap-1.5 md:flex">
                <button
                  type="button"
                  className={STEP}
                  aria-label={m.undo()}
                  title={m.undo()}
                  disabled={!canUndo}
                  onClick={undo}
                >
                  ↶
                </button>
                <button
                  type="button"
                  className={STEP}
                  aria-label={m.redo()}
                  title={m.redo()}
                  disabled={!canRedo}
                  onClick={redo}
                >
                  ↷
                </button>
              </div>
            )}
            {canEdit && (
              <Button primary title={m.new_event_hint()} onClick={() => newEvent()}>
                ＋ {m.event()}
              </Button>
            )}
            <Menu label={m.more_actions()} items={menu} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarFilter
            calendars={plan.calendars}
            hidden={hidden}
            onToggle={toggle}
            onSolo={(id) =>
              solo(
                id,
                plan.calendars.map((c) => c.id),
              )
            }
            onManage={canEdit ? () => setCalendarsOpen(true) : undefined}
          />
          <div role="group" aria-label={m.view()} className="ml-auto hidden gap-1.5 md:flex">
            {view === 'week' && (
              <Button
                className={PRESSED}
                aria-pressed={search.fullDay === true}
                title={m.full_day_hint()}
                onClick={go.fullDay}
              >
                {m.full_day()}
              </Button>
            )}
            <Button className={PRESSED} aria-pressed={expanded} title={m.expand_hint()} onClick={go.expand}>
              {expanded ? m.collapse() : m.expand()}
            </Button>
          </div>
        </div>
      </div>

      {canEdit && overdue.length > 0 && !overdueHidden && (
        <div
          className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-[13.5px]"
          role="status"
        >
          <span className="min-w-0 flex-1 basis-full md:basis-0">{m.overdue({ count: overdue.length })}</span>
          <button
            type="button"
            className="font-semibold text-done-ink hover:underline"
            onClick={() => void changeQuietly({ type: 'events.done', uids: overdue.map((e) => e.uid), done: true })}
          >
            ✓ {m.overdue_mark()}
          </button>
          <button
            type="button"
            className="font-semibold text-focus hover:underline"
            onClick={() => setShiftFrom(overdue[0].start.slice(0, 10))}
          >
            {m.shift_plan()}
          </button>
          <button
            type="button"
            className="text-muted hover:text-ink"
            aria-label={m.close()}
            onClick={() => setOverdueHidden(true)}
          >
            ✕
          </button>
        </div>
      )}

      {saveError && (
        <p className="mb-3 text-[13px] text-today-ink" role="alert">
          {saveError}
        </p>
      )}
      {lastStep && (
        <div
          className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-[13.5px]"
          role="status"
        >
          <span className="min-w-0 flex-1 truncate">{lastStep.label}</span>
          <button type="button" className="font-semibold text-focus hover:underline" onClick={undo}>
            {m.undo()}
          </button>
          <button type="button" className="text-muted hover:text-ink" onClick={() => setHistoryOpen(true)}>
            {m.history()}
          </button>
          <button
            type="button"
            className="text-muted hover:text-ink"
            aria-label={m.close()}
            onClick={session.dismissLastStep}
          >
            ✕
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 items-start gap-4 ${expanded ? '' : 'lg:grid-cols-[1fr_280px]'}`}>
        <section className="min-w-0 rounded-2xl border border-line bg-surface">
          {view === 'week' && (
            <WeekGrid
              plan={plan}
              weekStart={weekStart}
              fullDay={search.fullDay === true}
              items={weekItems}
              now={now}
              onSelect={select}
              onMove={canEdit ? move : undefined}
              onRemove={canEdit ? remove : undefined}
              onCreate={canEdit ? newEvent : undefined}
            />
          )}
          {view === 'month' && (
            <MonthGrid
              plan={plan}
              monthStart={monthStart}
              gridStart={monthGridStart}
              weeks={monthWeeks}
              items={monthItems}
              now={now}
              onSelect={select}
              onPickDay={(day) => onSearchChange({ view: 'week', week: ymd(mondayOf(day)) })}
              onMove={canEdit ? move : undefined}
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
        draft={draft}
        edited={selected !== null && session.edited.has(selected.uid)}
        canEdit={canEdit}
        onChange={session.change}
        onClose={() => {
          setDraft(null)
          if (search.event) onSearchChange({ event: undefined })
        }}
      />
      <CalendarsDialog
        plan={plan}
        open={calendarsOpen}
        onChange={session.change}
        undo={lastStep}
        trashCount={trashCount}
        onOpenTrash={() => (setCalendarsOpen(false), setTrashOpen(true))}
        onClose={() => setCalendarsOpen(false)}
      />
      <ShiftDialog plan={plan} from={shiftFrom} onChange={session.change} onClose={() => setShiftFrom(null)} />
      <TrashDialog
        plan={plan}
        trash={session.trash}
        open={trashOpen}
        onChange={session.change}
        onClose={() => setTrashOpen(false)}
      />
      <HistoryDialog
        open={historyOpen}
        history={session.history}
        mod={mod}
        now={now}
        onTravel={session.travel}
        onClose={() => setHistoryOpen(false)}
      />
      <CommandPalette
        open={paletteOpen}
        plan={plan}
        commands={actions}
        onSelectEvent={select}
        onClose={() => setPaletteOpen(false)}
      />
      <ShortcutsDialog
        open={shortcutsOpen}
        rows={[
          { keys: `${mod} K`, label: m.search() },
          ...(canEdit
            ? [
                { keys: `${mod} Z`, label: m.undo() },
                { keys: `${mod} ⇧ Z`, label: m.redo() },
              ]
            : []),
          ...actions.flatMap((a) => (a.keys ? [{ keys: a.keys, label: a.label }] : [])),
          ...(canEdit
            ? [
                { keys: 'Alt ← ↑ ↓ →', label: m.shortcut_move_event() },
                { keys: 'Alt Shift ↑ ↓', label: m.shortcut_resize_event() },
                { keys: 'Delete', label: m.shortcut_delete_event() },
              ]
            : []),
        ]}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  )
}
