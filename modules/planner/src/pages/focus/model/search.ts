/** The focus page's state in the URL */
export interface FocusSearch {
  /** uid of the session to time, so a link from the planner opens the one that was picked */
  session?: string | undefined
  /** The stopwatch takes the whole window: the page header is hidden */
  expanded?: true | undefined
}

export const parseFocusSearch = (search: Record<string, unknown>): FocusSearch => ({
  session: typeof search.session === 'string' && search.session ? search.session : undefined,
  expanded: search.expanded === true ? true : undefined,
})
