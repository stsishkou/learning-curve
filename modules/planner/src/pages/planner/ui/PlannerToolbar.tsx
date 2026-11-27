import { m } from '@lc/i18n/messages'
import { parseLocal, ymd } from '@lc/plan-domain'
import {
  Briefcase,
  Button,
  ChevronLeft,
  ChevronRight,
  Clock,
  Hint,
  Kbd,
  Menu,
  PanelRight,
  Plus,
  Redo2,
  Search,
  Segmented,
  stickyTop,
  Undo2,
  ZoomIn,
  ZoomOut,
  type MenuItem,
} from '@lc/ui'
import { useRef, type ReactNode } from 'react'

import { ScreenButtons } from '../../../shared/ui'
import type { PlannerViewState } from '../model/use-planner-view'

interface Props {
  nav: PlannerViewState
  /** The `⌘` or `Ctrl` of this keyboard, for the search hint */
  mod: string
  /** The rows of the `⋮` menu */
  menu: MenuItem[]
  onSearch: () => void
  /** Present when the plan can be edited */
  onNewEvent?: (() => void) | undefined
  /** Present when the plan can be edited: `can` says whether there is a step to take */
  history?: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void } | undefined
  /** The calendar chips, on the second row */
  children: ReactNode
  /** Shown at the end of the second row, on a phone too */
  summary?: ReactNode
  /**
   * Keeps the toolbar at the top while the page scrolls. For the expanded calendar, where the page header is
   * gone and the toolbar is the only way to another view or period.
   */
  pinned?: boolean
  /** Present where the browser can fill the whole screen */
  fullscreen?: { on: boolean; toggle: () => void } | undefined
  /** Present in the wide layout: the switches of the side panels */
  panels?: MenuItem[] | undefined
  /** Something in the `⋮` menu waits for the person, such as a calendar app to sign in to again */
  attention?: boolean | undefined
}

// The negative margins take the bar to the edges of the page padding, as the page header does.
const PINNED =
  'sticky top-0 z-20 -mx-3 -mt-3.5 border-b border-line-soft bg-bg/90 px-3 py-2.5 backdrop-blur-md md:-mx-5 md:-mt-5 md:px-5 md:py-3'
const PRESSED = 'aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'
const STEP =
  'grid size-9 place-items-center rounded-[10px] border border-line bg-surface whitespace-nowrap transition-[background-color,transform] duration-150 hover:bg-surface-2 motion-safe:active:scale-[0.96] disabled:opacity-40 disabled:hover:bg-surface motion-safe:disabled:active:scale-100'

/** Two rows above the calendar: which view and period, search and editing; then the calendars and how they show. */
export function PlannerToolbar({
  nav,
  mod,
  menu,
  onSearch,
  onNewEvent,
  history,
  children,
  summary,
  pinned = false,
  fullscreen,
  panels,
  attention = false,
}: Props) {
  const datePicker = useRef<HTMLInputElement>(null)
  const timeGrid = nav.view === 'week' || nav.view === 'day'
  return (
    // The single column may not grow with its content: the calendar chips scroll inside their row instead.
    <div
      ref={pinned ? stickyTop : undefined}
      className={`mb-3 grid grid-cols-[minmax(0,1fr)] gap-2.5 print:hidden ${pinned ? PINNED : ''}`}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <Segmented
          label={m.view()}
          value={nav.view}
          options={[
            { value: 'day', label: m.view_day() },
            { value: 'week', label: m.view_week() },
            { value: 'month', label: m.view_month() },
            { value: 'year', label: m.view_year() },
            { value: 'list', label: m.view_list() },
          ]}
          onChange={nav.show}
        />
        <Hint title={m.help_views_title()} text={m.help_views()} />
        {nav.view !== 'list' && (
          <div
            role="group"
            aria-label={m.palette_navigate()}
            className="order-last flex w-full items-center gap-1.5 md:order-none md:w-auto"
          >
            <button
              type="button"
              className={STEP}
              aria-label={m.previous_period()}
              data-tip={m.previous_period()}
              onClick={() => nav.step(-1)}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <h2 className="relative mx-0.5 flex-1 text-center md:min-w-[170px] md:flex-none">
              <button
                type="button"
                className="w-full rounded-lg px-2 py-1.5 text-[14px]/[1.2] font-semibold whitespace-nowrap hover:bg-surface-2 md:text-[16px]/[1.2]"
                data-tip={m.jump_to_date()}
                onClick={() => datePicker.current?.showPicker()}
              >
                {nav.title}
              </button>
              {/* The native date picker opens from the title; the field itself stays out of sight and out of the tab order. */}
              <input
                ref={datePicker}
                type="date"
                tabIndex={-1}
                aria-label={m.jump_to_date()}
                className="pointer-events-none absolute bottom-0 left-1/2 size-px opacity-0"
                value={ymd(nav.anchorDay)}
                onChange={(e) => e.target.value && nav.goTo(parseLocal(`${e.target.value}T00:00`))}
              />
            </h2>
            <button
              type="button"
              className={STEP}
              aria-label={m.next_period()}
              data-tip={m.next_period()}
              onClick={() => nav.step(1)}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
            <Button onClick={nav.today}>{m.go_today()}</Button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Hint title={m.help_event_title()} text={m.help_event()} />
          <Button
            className="hidden items-center gap-2 text-muted md:flex"
            icon={<Search size={15} aria-hidden />}
            label={m.search()}
            onClick={onSearch}
          >
            <Kbd>{mod} K</Kbd>
          </Button>
          {history && (
            <div role="group" aria-label={m.history()} className="hidden gap-1.5 md:flex">
              <button
                type="button"
                className={STEP}
                aria-label={m.undo()}
                data-tip={m.undo()}
                disabled={!history.canUndo}
                onClick={history.undo}
              >
                <Undo2 size={17} aria-hidden />
              </button>
              <button
                type="button"
                className={STEP}
                aria-label={m.redo()}
                data-tip={m.redo()}
                disabled={!history.canRedo}
                onClick={history.redo}
              >
                <Redo2 size={17} aria-hidden />
              </button>
            </div>
          )}
          {onNewEvent && (
            <Button
              primary
              className="flex items-center gap-1.5"
              icon={<Plus size={16} aria-hidden />}
              label={m.event()}
              data-tip={m.new_event_hint()}
              onClick={onNewEvent}
            />
          )}
          {history && <Hint title={m.help_history_title()} text={m.help_history()} className="max-md:hidden" />}
          <Menu label={m.more_actions()} items={menu} dot={attention} />
          <Hint title={m.help_more_title()} text={m.help_more()} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <div className="ml-auto flex items-center gap-3">
          {summary}
          <div role="group" aria-label={m.view()} className="hidden gap-1.5 md:flex">
            {timeGrid && (
              <div role="group" aria-label={m.time_scale()} className="flex gap-1.5">
                <button
                  type="button"
                  className={STEP}
                  aria-label={m.zoom_out()}
                  data-tip={m.zoom_out()}
                  disabled={!nav.canZoomOut}
                  onClick={nav.zoomOut}
                >
                  <ZoomOut size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className={STEP}
                  aria-label={m.zoom_in()}
                  data-tip={m.zoom_in()}
                  disabled={!nav.canZoomIn}
                  onClick={nav.zoomIn}
                >
                  <ZoomIn size={16} aria-hidden />
                </button>
              </div>
            )}
            {nav.view === 'week' && (
              <Button
                className={`flex items-center gap-1.5 ${PRESSED}`}
                aria-pressed={nav.workWeek}
                icon={<Briefcase size={15} aria-hidden />}
                label={m.work_week()}
                data-tip={m.work_week_hint()}
                onClick={nav.toggleWorkWeek}
              />
            )}
            {timeGrid && (
              <Button
                className={`flex items-center gap-1.5 ${PRESSED}`}
                aria-pressed={nav.fullDay}
                icon={<Clock size={15} aria-hidden />}
                label={m.full_day()}
                data-tip={m.full_day_hint()}
                onClick={nav.toggleFullDay}
              />
            )}
            {panels && <Menu label={m.side_panels()} icon={<PanelRight size={17} aria-hidden />} items={panels} />}
            <ScreenButtons
              expanded={nav.expanded}
              expandHint={m.expand_hint()}
              onToggleExpanded={nav.toggleExpanded}
              fullscreen={fullscreen}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
