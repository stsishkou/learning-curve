import { m } from '@lc/i18n/messages'
import { parseLocal, ymd } from '@lc/plan-domain'
import {
  Briefcase,
  Button,
  ChevronLeft,
  ChevronRight,
  Clock,
  Kbd,
  Maximize2,
  Menu,
  Minimize2,
  Plus,
  Redo2,
  Search,
  Segmented,
  Undo2,
  ZoomIn,
  ZoomOut,
  type MenuItem,
} from '@lc/ui'
import { useRef, type ReactNode } from 'react'

import type { PlannerViewState } from '../model/use-planner-view'

interface Props {
  nav: PlannerViewState
  /** The `⌘` or `Ctrl` of this keyboard, for the search hint */
  mod: string
  /** The rows of the `⋮` menu */
  menu: MenuItem[]
  onSearch: () => void
  /** Present when the plan can be edited */
  onNewEvent?: () => void
  /** Present when the plan can be edited: `can` says whether there is a step to take */
  history?: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void }
  /** The calendar chips, on the second row */
  children: ReactNode
}

const PRESSED = 'aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'
const STEP =
  'grid size-9 place-items-center rounded-[10px] border border-line bg-surface whitespace-nowrap transition-[background-color,transform] duration-150 hover:bg-surface-2 active:scale-[0.96] disabled:opacity-40 disabled:hover:bg-surface disabled:active:scale-100'

/** Two rows above the calendar: which view and period, search and editing; then the calendars and how they show. */
export function PlannerToolbar({ nav, mod, menu, onSearch, onNewEvent, history, children }: Props) {
  const datePicker = useRef<HTMLInputElement>(null)
  const timeGrid = nav.view === 'week' || nav.view === 'day'
  return (
    // The single column may not grow with its content: the calendar chips scroll inside their row instead.
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)] gap-2.5">
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
        {nav.view !== 'list' && (
          <div
            role="group"
            aria-label={m.palette_navigate()}
            className="order-last flex w-full items-center gap-1.5 md:order-none md:w-auto"
          >
            <button type="button" className={STEP} aria-label={m.previous_period()} onClick={() => nav.step(-1)}>
              <ChevronLeft size={18} aria-hidden />
            </button>
            <h2 className="relative mx-0.5 flex-1 text-center md:min-w-[170px] md:flex-none">
              <button
                type="button"
                className="w-full rounded-lg px-2 py-1.5 text-[14px]/[1.2] font-semibold whitespace-nowrap hover:bg-surface-2 md:text-[16px]/[1.2]"
                title={m.jump_to_date()}
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
            <button type="button" className={STEP} aria-label={m.next_period()} onClick={() => nav.step(1)}>
              <ChevronRight size={18} aria-hidden />
            </button>
            <Button onClick={nav.today}>{m.go_today()}</Button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Button className="hidden items-center gap-2 text-muted md:flex" onClick={onSearch}>
            <Search size={15} aria-hidden /> {m.search()} <Kbd>{mod} K</Kbd>
          </Button>
          {history && (
            <div role="group" aria-label={m.history()} className="hidden gap-1.5 md:flex">
              <button
                type="button"
                className={STEP}
                aria-label={m.undo()}
                title={m.undo()}
                disabled={!history.canUndo}
                onClick={history.undo}
              >
                <Undo2 size={17} aria-hidden />
              </button>
              <button
                type="button"
                className={STEP}
                aria-label={m.redo()}
                title={m.redo()}
                disabled={!history.canRedo}
                onClick={history.redo}
              >
                <Redo2 size={17} aria-hidden />
              </button>
            </div>
          )}
          {onNewEvent && (
            <Button primary className="flex items-center gap-1.5" title={m.new_event_hint()} onClick={onNewEvent}>
              <Plus size={16} aria-hidden /> {m.event()}
            </Button>
          )}
          <Menu label={m.more_actions()} items={menu} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <div role="group" aria-label={m.view()} className="ml-auto hidden gap-1.5 md:flex">
          {timeGrid && (
            <div role="group" aria-label={m.time_scale()} className="flex gap-1.5">
              <button
                type="button"
                className={STEP}
                aria-label={m.zoom_out()}
                title={m.zoom_out()}
                disabled={!nav.canZoomOut}
                onClick={nav.zoomOut}
              >
                <ZoomOut size={16} aria-hidden />
              </button>
              <button
                type="button"
                className={STEP}
                aria-label={m.zoom_in()}
                title={m.zoom_in()}
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
              title={m.work_week_hint()}
              onClick={nav.toggleWorkWeek}
            >
              <Briefcase size={15} aria-hidden /> {m.work_week()}
            </Button>
          )}
          {timeGrid && (
            <Button
              className={`flex items-center gap-1.5 ${PRESSED}`}
              aria-pressed={nav.fullDay}
              title={m.full_day_hint()}
              onClick={nav.toggleFullDay}
            >
              <Clock size={15} aria-hidden /> {m.full_day()}
            </Button>
          )}
          <Button
            className={`flex items-center gap-1.5 ${PRESSED}`}
            aria-pressed={nav.expanded}
            title={m.expand_hint()}
            onClick={nav.toggleExpanded}
          >
            {nav.expanded ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
            {nav.expanded ? m.collapse() : m.expand()}
          </Button>
        </div>
      </div>
    </div>
  )
}
