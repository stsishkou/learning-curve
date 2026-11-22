import { fmtDay, fmtMonth, fmtShort } from '@lc/i18n/format'
import {
  DAY,
  mondayOf,
  nowMinsk,
  parseLocal,
  planStart,
  startOfDay,
  startOfMonth,
  ymd,
  type Plan,
} from '@lc/plan-domain'

import type { PlannerSearch, PlannerView, PlannerZoom } from './search'

function defaultWeek(plan: Plan) {
  const now = nowMinsk()
  const first = planStart(plan)
  return mondayOf(now < first ? first : now)
}

/** The first Monday of a month: its Thursday is always inside that month. */
const firstWeekOf = (month: number) => mondayOf(month + 6 * DAY)
/** The Monday of a year's first week: the week that holds 4 January. */
const firstWeekOfYear = (year: number) => mondayOf(Date.UTC(year, 0, 4))
const yearOf = (t: number) => new Date(t).getUTCFullYear()

const ZOOM: (PlannerZoom | undefined)[] = ['compact', undefined, 'large']
const HOUR_HEIGHT = { compact: 40, normal: 56, large: 84 }

/** What the URL says is on screen, as dates, and the ways to move it. */
export function usePlannerView(plan: Plan, search: PlannerSearch, onSearchChange: (patch: PlannerSearch) => void) {
  const view: PlannerView = search.view ?? 'week'
  const expanded = search.expanded === true
  const fullDay = search.fullDay === true
  const workWeek = search.workWeek === true
  const weekStart = search.week ? mondayOf(parseLocal(search.week)) : defaultWeek(plan)
  // The month and the year a week belongs to are those of its Thursday, so a week that straddles two is not lost.
  const monthStart = startOfMonth(weekStart + 3 * DAY)
  const monthGridStart = mondayOf(monthStart)
  const monthWeeks = Math.ceil((startOfMonth(monthStart, 1) - monthGridStart) / (7 * DAY))
  const year = yearOf(weekStart + 3 * DAY)

  // Without a day in the URL the day view shows today, or the Monday of a week that today is not in.
  const today = startOfDay(nowMinsk())
  const dayStart = search.day
    ? startOfDay(parseLocal(search.day))
    : today >= weekStart && today < weekStart + 7 * DAY
      ? today
      : weekStart
  /** The day columns of the grid: one day, a work week or a week */
  const grid = view === 'day' ? { start: dayStart, days: 1 } : { start: weekStart, days: workWeek ? 5 : 7 }

  /** Shows the period that holds `day`, in the view that is on screen */
  const goTo = (day: number) => onSearchChange({ week: ymd(mondayOf(day)), day: view === 'day' ? ymd(day) : undefined })
  const zoomBy = (direction: 1 | -1) => {
    const next = Math.max(0, Math.min(ZOOM.length - 1, ZOOM.indexOf(search.zoom) + direction))
    onSearchChange({ zoom: ZOOM[next] })
  }

  const lastDay = weekStart + (grid.days - 1) * DAY
  const titles: Record<PlannerView, string> = {
    day: `${fmtDay(dayStart)} ${yearOf(dayStart)}`,
    week: `${fmtShort(weekStart)} – ${fmtShort(lastDay)} ${yearOf(lastDay)}`,
    month: fmtMonth(monthStart),
    year: String(year),
    list: '',
  }
  const steps: Record<PlannerView, (direction: 1 | -1) => number> = {
    day: (direction) => dayStart + direction * DAY,
    week: (direction) => weekStart + direction * 7 * DAY,
    month: (direction) => firstWeekOf(startOfMonth(monthStart, direction)),
    year: (direction) => firstWeekOfYear(year + direction),
    list: () => weekStart,
  }

  return {
    view,
    expanded,
    fullDay,
    workWeek,
    weekStart,
    dayStart,
    grid,
    monthStart,
    monthGridStart,
    monthWeeks,
    year,
    hourHeight: HOUR_HEIGHT[search.zoom ?? 'normal'],
    /** The day the date picker shows as chosen */
    anchorDay: view === 'day' ? dayStart : weekStart,
    /** The period on screen, as the toolbar names it */
    title: titles[view],
    goTo,
    /** One period back or forward: a day, a week, a month or a year, as the view has it */
    step: (direction: 1 | -1) => goTo(steps[view](direction)),
    today: () => onSearchChange({ week: undefined, day: undefined }),
    show: (next: PlannerView) => onSearchChange({ view: next, day: next === 'day' ? search.day : undefined }),
    /** Opens one day in the day view */
    showDay: (day: number) => onSearchChange({ view: 'day', day: ymd(day), week: ymd(mondayOf(day)) }),
    /** Opens the week that holds `day` */
    showWeek: (day: number) => onSearchChange({ view: 'week', week: ymd(mondayOf(day)), day: undefined }),
    toggleFullDay: () => onSearchChange({ fullDay: fullDay ? undefined : true }),
    toggleExpanded: () => onSearchChange({ expanded: expanded ? undefined : true }),
    toggleWorkWeek: () => onSearchChange({ workWeek: workWeek ? undefined : true }),
    canZoomIn: search.zoom !== 'large',
    canZoomOut: search.zoom !== 'compact',
    zoomIn: () => zoomBy(1),
    zoomOut: () => zoomBy(-1),
  }
}

export type PlannerViewState = ReturnType<typeof usePlannerView>
