export type PlannerView = 'week' | 'month' | 'list'

/** What the planner keeps in the URL, so a week, a view or an event can be linked and survives a reload. */
export interface PlannerSearch {
  /** Monday of the visible week, YYYY-MM-DD */
  week?: string
  view?: PlannerView
  /** The week grid shows all 24 hours instead of only the hours that have events */
  fullDay?: true
  /** The calendar takes the whole window: the header, the runway and the side panel are hidden */
  expanded?: true
  /** uid of the event whose dialog is open */
  event?: string
}

const VIEWS: readonly unknown[] = ['week', 'month', 'list'] satisfies PlannerView[]
const isView = (value: unknown): value is PlannerView => VIEWS.includes(value)

export const parsePlannerSearch = (search: Record<string, unknown>): PlannerSearch => ({
  week: typeof search.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.week) ? search.week : undefined,
  view: isView(search.view) ? search.view : undefined,
  fullDay: search.fullDay === true ? true : undefined,
  expanded: search.expanded === true ? true : undefined,
  event: typeof search.event === 'string' && search.event ? search.event : undefined,
})
