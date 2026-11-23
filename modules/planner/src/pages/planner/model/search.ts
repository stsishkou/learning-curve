export type PlannerView = 'day' | 'week' | 'month' | 'year' | 'list'
export type PlannerZoom = 'compact' | 'large'

/** What the planner keeps in the URL, so a week, a view or an event can be linked and survives a reload. */
export interface PlannerSearch {
  /** Monday of the visible week, YYYY-MM-DD */
  week?: string
  /** The day of the day view, YYYY-MM-DD; without it the day view shows today */
  day?: string
  view?: PlannerView
  /** The week grid shows Monday to Friday only */
  workWeek?: true
  /** The time scale of the day and week grids; without it an hour has its usual height */
  zoom?: PlannerZoom
  /** The week grid shows all 24 hours instead of only the hours that have events */
  fullDay?: true
  /** The calendar takes the whole window: the header, the runway and the side panel are hidden */
  expanded?: true
  /** Sessions marked done are left out of the day, week and month views */
  hideDone?: true
  /** uid of the event whose dialog is open */
  event?: string
}

const VIEWS: readonly unknown[] = ['day', 'week', 'month', 'year', 'list'] satisfies PlannerView[]
const DATE = /^\d{4}-\d{2}-\d{2}$/
const isView = (value: unknown): value is PlannerView => VIEWS.includes(value)

export const parsePlannerSearch = (search: Record<string, unknown>): PlannerSearch => ({
  week: typeof search.week === 'string' && DATE.test(search.week) ? search.week : undefined,
  day: typeof search.day === 'string' && DATE.test(search.day) ? search.day : undefined,
  view: isView(search.view) ? search.view : undefined,
  workWeek: search.workWeek === true ? true : undefined,
  zoom: search.zoom === 'compact' || search.zoom === 'large' ? search.zoom : undefined,
  fullDay: search.fullDay === true ? true : undefined,
  expanded: search.expanded === true ? true : undefined,
  hideDone: search.hideDone === true ? true : undefined,
  event: typeof search.event === 'string' && search.event ? search.event : undefined,
})
