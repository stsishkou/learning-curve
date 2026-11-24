import type { Occurrence } from '@lc/plan-domain'

/** Names one occurrence on the page: the grids put it in `data-key`, so a repeat is told from its series. */
export const eventKey = (o: Pick<Occurrence, 'uid' | 's'>) => `${o.uid}-${o.s}`
