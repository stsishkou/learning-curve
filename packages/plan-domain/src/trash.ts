import { DAY } from './dates'
import { applyEdits, without, type PlanEdits } from './edits'
import type { Plan, PlanCalendar, PlanEvent } from './types'

/** How long a removed event or calendar can still be restored. */
export const TRASH_DAYS = 30

export interface TrashedEvent {
  event: PlanEvent
  /** Days until it is removed for good, at least 1 */
  daysLeft: number
}

export interface TrashedCalendar {
  calendar: PlanCalendar
  /** Events that come back with it */
  events: number
  daysLeft: number
}

export interface PlanTrash {
  events: TrashedEvent[]
  calendars: TrashedCalendar[]
}

export const emptyTrash = (): PlanTrash => ({ events: [], calendars: [] })

const deadline = (removedAt: string) => Date.parse(removedAt) + TRASH_DAYS * DAY
const daysLeft = (removedAt: string, now: number) => Math.max(1, Math.ceil((deadline(removedAt) - now) / DAY))

/** What can still be restored, the most recently removed last. `base` is the plan without any edits. */
export function trashOf(base: Plan, edits: PlanEdits, now = Date.now()): PlanTrash {
  const { events, calendars } = edits.removed
  const full = applyEdits(base, { ...edits, removed: { events: {}, calendars: {} } }).plan
  const open = (at: string | null | undefined): at is string => typeof at === 'string' && deadline(at) > now
  return {
    calendars: full.calendars.flatMap((calendar) => {
      const at = calendars[calendar.id]
      if (!open(at)) return []
      const count = full.events.filter((e) => e.calendar === calendar.id && !(e.uid in events)).length
      return [{ calendar, events: count, daysLeft: daysLeft(at, now) }]
    }),
    events: full.events.flatMap((event) => {
      const at = events[event.uid]
      // An event of a removed calendar comes back with the calendar, not on its own.
      if (!open(at) || event.calendar in calendars) return []
      return [{ event, daysLeft: daysLeft(at, now) }]
    }),
  }
}

/**
 * Drops what has been in the trash longer than `TRASH_DAYS`. Events and calendars made in the viewer disappear
 * from the edits; generated ones keep a `null` mark, because the schedule would bring them back otherwise.
 */
export function purgeTrash(base: Plan, edits: PlanEdits, now = Date.now()): PlanEdits {
  const next = structuredClone(edits)
  const { removed } = next
  const expired = (at: string | null): at is string => at !== null && deadline(at) <= now

  for (const [id, at] of Object.entries(removed.calendars)) {
    if (!expired(at)) continue
    if (base.calendars.some((c) => c.id === id)) {
      removed.calendars[id] = null
      continue
    }
    removed.calendars = without(removed.calendars, id)
    next.calendars = without(next.calendars, id)
    const order = next.order?.filter((other) => other !== id)
    if (order?.length) next.order = order
    else delete next.order
    const hidden = next.hidden?.filter((other) => other !== id)
    if (hidden?.length) next.hidden = hidden
    else delete next.hidden
    next.added = next.added.filter((e) => e.calendar !== id)
    for (const [uid, patch] of Object.entries(next.events)) {
      if (patch.calendar !== id) continue
      next.events = without(next.events, uid)
      removed.events[uid] = null
    }
  }
  for (const [uid, at] of Object.entries(removed.events)) {
    if (!expired(at)) continue
    next.events = without(next.events, uid)
    if (base.events.some((e) => e.uid === uid)) {
      removed.events[uid] = null
    } else {
      removed.events = without(removed.events, uid)
      next.added = next.added.filter((e) => e.uid !== uid)
    }
  }
  return next
}
