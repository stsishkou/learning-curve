import { parseLocal, toLocalString, type Plan } from '@lc/plan-domain'
import { writtenHash, writtenOf, type CalendarSync, type InboxItem } from '@lc/plan-domain/sync'

import type { CalendarAdapter } from '../../ports'
import { lanes } from './lanes'
import { dropRow, takeIn, type SyncSession } from './round'

const isCurrent = (plan: Plan, item: InboxItem) => {
  const event = plan.events.find((e) => e.uid === item.uid)
  return event !== undefined && writtenHash(writtenOf(event)) === item.basis
}

/**
 * Puts the plan's version back over a proposal. A repeat the app keeps on its own is restored, or deleted when the
 * plan skips that day; anything else is written again by the next round.
 */
const putBack = (app: CalendarAdapter, plan: Plan, sync: CalendarSync, items: InboxItem[]) =>
  lanes(items, async (item) => {
    const row = sync.events[item.uid]
    const event = plan.events.find((e) => e.uid === item.uid)
    if (!row) return
    if (!item.day) {
      if (item.change === null) dropRow(sync, item.uid)
      else Object.assign(row, { etag: item.etag, hash: '' })
    } else if (!event || event.skip?.includes(item.day)) {
      await app.deleteEvent(row.calendar, item.source)
    } else {
      const start = `${item.day}T${event.start.slice(11, 16)}`
      const end = toLocalString(parseLocal(start) + parseLocal(event.end) - parseLocal(event.start))
      if ((await app.restoreRepeat(row, item.source, { start, end })) === 'gone') dropRow(sync, item.uid)
    }
  })

/** Leaves the chosen items out of the inbox, and measures what is left for their events against the plan now. */
function settle(sync: CalendarSync, plan: Plan, chosen: InboxItem[]) {
  const ids = new Set(chosen.map((item) => item.id))
  const uids = new Set(chosen.map((item) => item.uid))
  sync.inbox = sync.inbox
    .filter((item) => !ids.has(item.id))
    .map((item) => {
      const event = uids.has(item.uid) ? plan.events.find((e) => e.uid === item.uid) : undefined
      return event ? { ...item, basis: writtenHash(writtenOf(event)) } : item
    })
}

/**
 * Takes the app's version of the chosen held edits into the plan, as a round does with the rest. One the plan has
 * moved past since it was read gets the plan's version instead. `plan` is the plan as the decision began.
 */
export async function acceptProposals(session: SyncSession, plan: Plan, ids: readonly string[]): Promise<void> {
  const { app, sync } = session
  const chosen = sync.inbox.filter((item) => ids.includes(item.id))
  const taken = chosen.filter((item) => isCurrent(plan, item))
  await takeIn(session, taken)
  await putBack(
    app,
    plan,
    sync,
    chosen.filter((item) => !taken.includes(item)),
  )
  settle(sync, await session.plan(), chosen)
}

/** Keeps the plan's version of the chosen held edits, written over the edit in the app by the next round. */
export async function rejectProposals(session: SyncSession, plan: Plan, ids: readonly string[]): Promise<void> {
  const chosen = session.sync.inbox.filter((item) => ids.includes(item.id))
  await putBack(session.app, plan, session.sync, chosen)
  settle(session.sync, plan, chosen)
}
