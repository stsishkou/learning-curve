/** The timeline's state in the URL */
export interface TimelineSearch {
  /** The timeline takes the whole window: the page header and its how-to are hidden */
  expanded?: true | undefined
}

export const parseTimelineSearch = (search: Record<string, unknown>): TimelineSearch => ({
  expanded: search.expanded === true ? true : undefined,
})
