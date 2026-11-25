import { isCalendarProvider, type CalendarProvider } from '@lc/plan-domain'

import { SIGN_IN_ENDS, type SignInEnd } from '../../../features/calendar-sync'

export type PlannerView = 'day' | 'week' | 'month' | 'year' | 'list'
export type PlannerZoom = 'compact' | 'large'

/** What the planner keeps in the URL, so a week, a view or an event can be linked and survives a reload. */
export interface PlannerSearch {
  /** Monday of the visible week, YYYY-MM-DD */
  week?: string | undefined
  /** The day of the day view, YYYY-MM-DD; without it the day view shows today */
  day?: string | undefined
  view?: PlannerView | undefined
  /** The week grid shows Monday to Friday only */
  workWeek?: true | undefined
  /** The time scale of the day and week grids; without it an hour has its usual height */
  zoom?: PlannerZoom | undefined
  /** The week grid shows all 24 hours instead of only the hours that have events */
  fullDay?: true | undefined
  /** The calendar takes the whole window: the header, the runway and the side panel are hidden */
  expanded?: true | undefined
  /** Sessions marked done are left out of the day, week and month views */
  hideDone?: true | undefined
  /** uid of the event whose dialog is open */
  event?: string | undefined
  /** The done sessions without a time open in a list, to fill in how long each took */
  fill?: true | undefined
  /** The calendar app a sign-in just came back from; its dialog opens to say how it went */
  link?: CalendarProvider | undefined
  /** How that sign-in went */
  signin?: SignInEnd | undefined
}

const VIEWS: readonly unknown[] = ['day', 'week', 'month', 'year', 'list'] satisfies PlannerView[]
const DATE = /^\d{4}-\d{2}-\d{2}$/
const isView = (value: unknown): value is PlannerView => VIEWS.includes(value)
const SIGN_INS: readonly unknown[] = SIGN_IN_ENDS
const isSignInEnd = (value: unknown): value is SignInEnd => SIGN_INS.includes(value)

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
  fill: search.fill === true ? true : undefined,
  link: isCalendarProvider(search.link) ? search.link : undefined,
  signin: isSignInEnd(search.signin) ? search.signin : undefined,
})
