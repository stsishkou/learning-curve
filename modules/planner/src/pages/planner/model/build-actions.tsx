import { m } from '@lc/i18n/messages'
import type { PlanCalendar } from '@lc/plan-domain'
import {
  Bell,
  CircleHelp,
  EyeOff,
  Briefcase,
  Calendar,
  CalendarClock,
  CalendarSync,
  Clock,
  Globe,
  GraduationCap,
  History,
  Keyboard,
  Maximize,
  Maximize2,
  Printer,
  MoveHorizontal,
  Redo2,
  Search,
  Settings,
  Trash2,
  Type,
  Undo2,
} from '@lc/ui'

import type { PlannerAction } from './planner-actions'
import type { PlannerViewState } from './use-planner-view'

export type DialogName =
  | 'calendars'
  | 'trash'
  | 'history'
  | 'catchUp'
  | 'review'
  | 'palette'
  | 'shortcuts'
  | 'zone'
  | 'busy'
  | 'integrations'
  | 'sync'
  | 'syncReview'
  | 'export'
  | 'countdown'
  | 'settings'
  | 'course'

interface Context {
  nav: PlannerViewState
  canEdit: boolean
  calendars: PlanCalendar[]
  /** How many calendars are switched off */
  hiddenCount: number
  history: { cursor: number; total: number; canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void }
  /** Name of the second time zone of the hour column, when one is chosen */
  secondZone?: string | undefined
  /** The calendar integrations: `waiting` edits made in calendar apps wait for the person */
  integrations: { waiting: number }
  /** Present where the browser can show notifications: `lead` is how many minutes before a start they come */
  reminders?: { on: boolean; lead: number; toggle: () => void } | undefined
  /** Present where the browser can fill the whole screen */
  fullscreen?: { on: boolean; toggle: () => void } | undefined
  /** The help marks next to the main features */
  help: { on: boolean; toggle: () => void }
  /** Buttons with an icon show only the icon */
  iconsOnly: { on: boolean; toggle: () => void }
  trashCount: number
  overdueCount: number
  open: (dialog: DialogName) => void
  newEvent: () => void
  shift: () => void
  only: (calendarId: string) => void
  showAll: () => void
}

const ICON = { size: 16, 'aria-hidden': true } as const

/** Every action of the planner page, in the order the command search and the `⋮` menu list them. */
export function buildActions(ctx: Context): PlannerAction[] {
  const { nav, history } = ctx
  const go = m.palette_navigate()
  const view = m.view()
  const plan = m.palette_plan()
  const timeGrid = nav.view === 'week' || nav.view === 'day'

  const editing: PlannerAction[] = [
    {
      id: 'undo',
      group: plan,
      label: m.undo(),
      icon: <Undo2 {...ICON} />,
      menu: 'narrow',
      disabled: !history.canUndo,
      run: history.undo,
    },
    {
      id: 'redo',
      group: plan,
      label: m.redo(),
      icon: <Redo2 {...ICON} />,
      menu: 'narrow',
      disabled: !history.canRedo,
      run: history.redo,
    },
    { id: 'new-event', group: plan, label: m.new_event(), keys: 'N', run: ctx.newEvent },
    {
      id: 'history',
      group: plan,
      label: m.history(),
      keys: 'H',
      icon: <History {...ICON} />,
      badge: history.total ? `${history.cursor}/${history.total}` : undefined,
      menu: 'always',
      run: () => ctx.open('history'),
    },
    {
      id: 'trash',
      group: plan,
      label: m.trash(),
      icon: <Trash2 {...ICON} />,
      badge: ctx.trashCount || undefined,
      menu: 'always',
      run: () => ctx.open('trash'),
    },
    {
      id: 'catch-up',
      group: plan,
      label: m.catchup(),
      icon: <CalendarClock {...ICON} />,
      badge: ctx.overdueCount || undefined,
      menu: 'always',
      run: () => ctx.open('catchUp'),
    },
    {
      id: 'shift',
      group: plan,
      label: m.reschedule(),
      icon: <MoveHorizontal {...ICON} />,
      menu: 'always',
      run: ctx.shift,
    },
    {
      id: 'calendars',
      group: plan,
      label: m.manage_calendars(),
      keys: 'C',
      icon: <Calendar {...ICON} />,
      menu: 'always',
      run: () => ctx.open('calendars'),
    },
    {
      id: 'new-course',
      group: plan,
      label: m.new_course(),
      icon: <GraduationCap {...ICON} />,
      menu: 'always',
      run: () => ctx.open('course'),
    },
  ]

  return [
    {
      id: 'search',
      group: plan,
      label: m.search(),
      icon: <Search {...ICON} />,
      menu: 'narrow',
      palette: false,
      run: () => ctx.open('palette'),
    },
    { id: 'today', group: go, label: m.go_today(), keys: 'T', run: nav.today },
    { id: 'previous', group: go, label: m.previous_period(), keys: '←', run: () => nav.step(-1) },
    { id: 'next', group: go, label: m.next_period(), keys: '→', run: () => nav.step(1) },
    { id: 'day', group: view, label: m.view_day(), keys: 'D', run: () => nav.show('day') },
    { id: 'week', group: view, label: m.view_week(), keys: 'W', run: () => nav.show('week') },
    { id: 'month', group: view, label: m.view_month(), keys: 'M', run: () => nav.show('month') },
    { id: 'year', group: view, label: m.view_year(), keys: 'Y', run: () => nav.show('year') },
    { id: 'list', group: view, label: m.view_list(), keys: 'L', run: () => nav.show('list') },
    {
      id: 'full-day',
      group: view,
      label: m.full_day_hint(),
      menuLabel: m.full_day(),
      keys: 'F',
      icon: <Clock {...ICON} />,
      checked: nav.fullDay,
      menu: timeGrid ? 'narrow' : undefined,
      run: nav.toggleFullDay,
    },
    {
      id: 'work-week',
      group: view,
      label: m.work_week_hint(),
      menuLabel: m.work_week(),
      keys: '5',
      icon: <Briefcase {...ICON} />,
      checked: nav.workWeek,
      menu: nav.view === 'week' ? 'narrow' : undefined,
      run: nav.toggleWorkWeek,
    },
    {
      id: 'hide-done',
      group: view,
      label: m.hide_done_hint(),
      menuLabel: m.hide_done(),
      keys: 'X',
      icon: <EyeOff {...ICON} />,
      checked: nav.hideDone,
      menu: nav.view === 'list' || nav.view === 'year' ? undefined : 'always',
      run: nav.toggleHideDone,
    },
    {
      id: 'print',
      group: view,
      label: m.print_view_hint(),
      menuLabel: m.print_view(),
      icon: <Printer {...ICON} />,
      menu: 'always',
      run: () => window.print(),
    },
    { id: 'zoom-in', group: view, label: m.zoom_in(), keys: '+', run: nav.zoomIn },
    { id: 'zoom-out', group: view, label: m.zoom_out(), keys: '-', run: nav.zoomOut },
    {
      id: 'expand',
      group: view,
      label: nav.expanded ? m.collapse() : m.expand_hint(),
      menuLabel: m.expand(),
      keys: 'E',
      icon: <Maximize2 {...ICON} />,
      checked: nav.expanded,
      menu: 'narrow',
      run: nav.toggleExpanded,
    },
    ...(ctx.fullscreen
      ? [
          {
            id: 'fullscreen',
            group: view,
            label: ctx.fullscreen.on ? m.fullscreen_exit() : m.fullscreen_hint(),
            menuLabel: m.fullscreen(),
            keys: 'Shift+F',
            icon: <Maximize {...ICON} />,
            checked: ctx.fullscreen.on,
            menu: 'narrow' as const,
            run: ctx.fullscreen.toggle,
          },
        ]
      : []),
    {
      id: 'second-zone',
      group: view,
      label: m.second_zone(),
      icon: <Globe {...ICON} />,
      badge: ctx.secondZone,
      menu: 'always',
      run: () => ctx.open('zone'),
    },
    {
      id: 'integrations',
      group: plan,
      label: m.integrations_title(),
      icon: <CalendarSync {...ICON} />,
      badge: ctx.integrations.waiting ? String(ctx.integrations.waiting) : undefined,
      menu: 'always',
      run: () => ctx.open('integrations'),
    },
    ...(ctx.reminders
      ? [
          {
            id: 'reminders',
            group: plan,
            label: m.reminders({ count: ctx.reminders.lead }),
            menuLabel: m.reminders_short(),
            icon: <Bell {...ICON} />,
            checked: ctx.reminders.on,
            menu: 'always' as const,
            run: ctx.reminders.toggle,
          },
        ]
      : []),
    { id: 'review', group: view, label: m.review_open(), run: () => ctx.open('review') },
    ...(ctx.canEdit ? editing : []),
    {
      id: 'help',
      group: plan,
      label: m.help_toggle(),
      icon: <CircleHelp {...ICON} />,
      checked: ctx.help.on,
      menu: 'always',
      run: ctx.help.toggle,
    },
    {
      id: 'icons-only',
      group: plan,
      label: m.icons_only(),
      icon: <Type {...ICON} />,
      checked: ctx.iconsOnly.on,
      menu: 'always',
      run: ctx.iconsOnly.toggle,
    },
    {
      id: 'settings',
      group: plan,
      label: m.settings(),
      icon: <Settings {...ICON} />,
      menu: 'always',
      run: () => ctx.open('settings'),
    },
    {
      id: 'shortcuts',
      group: plan,
      label: m.shortcuts(),
      keys: '?',
      icon: <Keyboard {...ICON} />,
      menu: 'always',
      run: () => ctx.open('shortcuts'),
    },
    ...ctx.calendars.map((c) => ({
      id: `only-${c.id}`,
      group: m.calendars(),
      label: m.calendar_only({ name: c.name }),
      run: () => ctx.only(c.id),
    })),
    ...(ctx.hiddenCount
      ? [{ id: 'show-all', group: m.calendars(), label: m.calendars_show_all(), run: ctx.showAll }]
      : []),
  ]
}
