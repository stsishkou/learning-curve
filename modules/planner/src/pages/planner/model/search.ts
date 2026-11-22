export type PlannerView = 'week' | 'list'

/** What the planner keeps in the URL, so a week or view can be linked and survives a reload. */
export interface PlannerSearch {
  /** Monday of the visible week, YYYY-MM-DD */
  week?: string
  view?: PlannerView
  /** The week grid shows all 24 hours instead of only the hours that have events */
  fullDay?: true
  /** The calendar takes the whole window: the header, the runway and the budget are hidden */
  expanded?: true
}

export const parsePlannerSearch = (search: Record<string, unknown>): PlannerSearch => ({
  week: typeof search.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.week) ? search.week : undefined,
  view: search.view === 'list' || search.view === 'week' ? search.view : undefined,
  fullDay: search.fullDay === true ? true : undefined,
  expanded: search.expanded === true ? true : undefined,
})
