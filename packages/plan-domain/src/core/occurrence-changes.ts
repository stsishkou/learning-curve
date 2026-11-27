import type { PlanChange } from './changes'
import { parseLocal, startOfDay, toLocalString, ymd } from './dates'
import type { Occurrence } from './occurrences'
import { movePatch } from './recurrence'
import type { PlanEvent } from './types'

/** One repeat of a series stops happening on `day` (`YYYY-MM-DD`); the other repeats stay. */
export const skipDay = (event: PlanEvent, day: string): PlanChange => ({
  type: 'event.patch',
  uid: event.uid,
  patch: { skip: [...(event.skip ?? []), day] },
})

/** An occurrence moved to a new slot: a repeat leaves its series and moves alone, anything else is patched. */
export function moveOccurrence(o: Occurrence, slot: { s: number; e: number }): PlanChange {
  if (!o.rrule) return { type: 'event.patch', uid: o.uid, patch: movePatch(o, o.s, slot.s, slot.e) }
  const start = o.allDay ? startOfDay(slot.s) : slot.s
  const end = o.allDay ? start + (parseLocal(o.end) - parseLocal(o.start)) : slot.e
  return { type: 'event.detach', uid: o.uid, day: ymd(o.s), start: toLocalString(start), end: toLocalString(end) }
}

/** An occurrence removed: one repeat of a series is skipped, anything else goes to the trash. */
export const removeOccurrence = (o: Occurrence): PlanChange =>
  o.rrule ? skipDay(o, ymd(o.s)) : { type: 'event.remove', uid: o.uid }
