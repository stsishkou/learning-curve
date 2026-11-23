/** The dashboard's state in the URL */
export interface DashboardSearch {
  /** The charts take the whole window: the page header is hidden */
  expanded?: true | undefined
}

export const parseDashboardSearch = (search: Record<string, unknown>): DashboardSearch => ({
  expanded: search.expanded === true ? true : undefined,
})
