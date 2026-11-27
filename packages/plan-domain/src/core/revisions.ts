import type { PlanEvent } from './types'

/** One event's version in the calendar feeds: what lets a subscriber tell a newer copy from an older one. */
export interface Revision {
  /** RFC 5545 `SEQUENCE`: 0 when first served, one more with every change a subscriber would see */
  seq: number
  /** When that change was first seen, UTC epoch ms (`LAST-MODIFIED`) */
  modified: number
  /** `hashText` of what the feed carries of the event */
  hash: string
}

/** By event uid. Rows of removed events stay, so an event put back from the trash continues upwards. */
export type Revisions = Record<string, Revision>

/** A short stable hash (53-bit cyrb53, base 36), for telling versions apart; not for anything secret. */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2_654_435_761)
    h2 = Math.imul(h2 ^ code, 1_597_334_677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2_246_822_507) ^ Math.imul(h2 ^ (h2 >>> 13), 3_266_489_909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2_246_822_507) ^ Math.imul(h1 ^ (h1 >>> 13), 3_266_489_909)
  return (4_294_967_296 * (2_097_151 & h2) + (h1 >>> 0)).toString(36)
}

const fingerprint = (e: PlanEvent) =>
  hashText(
    JSON.stringify([
      e.calendar,
      e.title,
      e.start,
      e.end,
      e.allDay === true,
      e.rrule ?? '',
      e.skip ?? [],
      e.description,
      e.availability,
      e.done === true,
      e.actual ?? 0,
    ]),
  )

/**
 * The revisions after `events`: an event that is new gets `seq` 0, one whose feed fields changed gets the next
 * `seq`, both stamped `now`; the others keep their row. Bumping on every change is simpler than following the list of
 * properties RFC 5546 §2.1.4 names, and allowed: other changes "MAY also require" it.
 */
export function reviseEvents(previous: Revisions, events: PlanEvent[], now: number): Revisions {
  const next: Revisions = { ...previous }
  for (const event of events) {
    const hash = fingerprint(event)
    const row = previous[event.uid]
    if (row?.hash === hash) continue
    next[event.uid] = { seq: row ? row.seq + 1 : 0, modified: now, hash }
  }
  return next
}

const isRevision = (value: unknown): value is Revision =>
  typeof value === 'object' &&
  value !== null &&
  'seq' in value &&
  Number.isInteger(value.seq) &&
  'modified' in value &&
  typeof value.modified === 'number' &&
  'hash' in value &&
  typeof value.hash === 'string'

/** Revisions read from a file; anything that is not one is left out. */
export function parseRevisions(value: unknown): Revisions {
  if (typeof value !== 'object' || value === null) return {}
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, Revision] => isRevision(entry[1])))
}
