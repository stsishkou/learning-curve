import { fmtMonth, fmtShort } from '@lc/i18n/format'
import { DAY, mondayOf, nowMinsk, parseLocal, planStart, startOfMonth, ymd, type Plan } from '@lc/plan-domain'

import type { PlannerSearch, PlannerView } from './search'

function defaultWeek(plan: Plan) {
  const now = nowMinsk()
  const first = planStart(plan)
  return mondayOf(now < first ? first : now)
}

/** The first Monday of a month: its Thursday is always inside that month. */
const firstWeekOf = (month: number) => mondayOf(month + 6 * DAY)

/** What the URL says is on screen, as dates, and the ways to move it. */
export function usePlannerView(plan: Plan, search: PlannerSearch, onSearchChange: (patch: PlannerSearch) => void) {
  const view: PlannerView = search.view ?? 'week'
  const expanded = search.expanded === true
  const fullDay = search.fullDay === true
  const weekStart = search.week ? mondayOf(parseLocal(search.week)) : defaultWeek(plan)
  // The month a week belongs to is the month of its Thursday, so a week that straddles two months is not lost.
  const monthStart = startOfMonth(weekStart + 3 * DAY)
  const monthGridStart = mondayOf(monthStart)
  const monthWeeks = Math.ceil((startOfMonth(monthStart, 1) - monthGridStart) / (7 * DAY))

  const setWeek = (t: number) => onSearchChange({ week: ymd(t) })
  return {
    view,
    expanded,
    fullDay,
    weekStart,
    monthStart,
    monthGridStart,
    monthWeeks,
    /** The period on screen, as the toolbar names it */
    title:
      view === 'month'
        ? fmtMonth(monthStart)
        : `${fmtShort(weekStart)} – ${fmtShort(weekStart + 6 * DAY)} ${new Date(weekStart + 6 * DAY).getUTCFullYear()}`,
    setWeek,
    /** One period back or forward: a week, or a month in the month view */
    step: (direction: 1 | -1) =>
      setWeek(view === 'month' ? firstWeekOf(startOfMonth(monthStart, direction)) : weekStart + direction * 7 * DAY),
    today: () => onSearchChange({ week: undefined }),
    show: (next: PlannerView) => onSearchChange({ view: next }),
    toggleFullDay: () => onSearchChange({ fullDay: fullDay ? undefined : true }),
    toggleExpanded: () => onSearchChange({ expanded: expanded ? undefined : true }),
  }
}

export type PlannerViewState = ReturnType<typeof usePlannerView>
