// What a calendar app has to offer for the plan to be kept in it: its sign-in, and the few calls the sync makes,
// already in the terms of `@lc/plan-domain`'s `calendar-sync`. The rules live there and in `engine.ts`, the same for
// every app.
import type { CalendarProvider, Plan } from '@lc/plan-domain'
import type { RemoteEvent, SyncCalendarRow, SyncRow, SyncState, Written } from '@lc/plan-domain/sync'

/** An event as the app stored it: its id there and its version. */
export interface Saved {
  id: string
  etag: string
}

export interface CalendarAdapter {
  /** Makes a calendar and returns its id */
  insertCalendar(name: string): Promise<string>
  renameCalendar(id: string, name: string): Promise<void>
  /** Best effort: a calendar the app may not delete stays, empty */
  deleteCalendar(id: string): Promise<void>
  /**
   * What the calendar `row` says now, or what changed in it since `row.cursor`, with where the reading ended;
   * `missing` when the calendar is gone.
   */
  readCalendar(
    row: SyncCalendarRow,
    plan: Plan,
    state: SyncState,
  ): Promise<{ events: RemoteEvent[]; cursor?: string | undefined } | 'missing'>
  /** The event `uid` was written as, as it is now; null when it is gone */
  getEvent(uid: string, row: SyncRow): Promise<RemoteEvent | null>
  insertEvent(calendar: string, uid: string, written: Written): Promise<Saved>
  /** `conflict` when the event changed in the app since `row.etag`; `missing` when it is not there */
  patchEvent(uid: string, row: SyncRow, written: Written): Promise<Saved | 'conflict' | 'missing'>
  /** Moves the event to calendar `to`; `written` is what it should say there */
  moveEvent(uid: string, row: SyncRow, to: string, written: Written): Promise<Saved | 'missing'>
  deleteEvent(calendar: string, id: string): Promise<void>
  /**
   * Puts repeat `source` of the series `row` back on its slot. `gone` when that took deleting the series, which the
   * next round writes again.
   */
  restoreRepeat(row: SyncRow, source: string, slot: { start: string; end: string }): Promise<'done' | 'gone'>
}

/** How the app signs a person in: OAuth 2.0 with the authorization code, PKCE and the person's own client. */
export interface OAuthConfig {
  authorize: string
  token: string
  /** Where a refresh token is revoked; absent when the app has no such endpoint */
  revoke?: string | undefined
  scope: string
  /** More parameters of the sign-in page */
  page: Record<string, string>
  /** The scope is sent with the token requests too */
  scopeOnToken: boolean
  /** Whether the scope a sign-in granted covers the calendars */
  granted: (scope: string) => boolean
  /** Environment variables that set the client on a host */
  env: { id: string; secret: string }
}

export interface CalendarKit {
  provider: CalendarProvider
  auth: OAuthConfig
  /** The calls of the app, with `token` giving an access token, a new one when `renew` is set */
  adapter: (token: (renew: boolean) => Promise<string>, timeZone: string) => CalendarAdapter
  /** A problem the planner explains for an error of the app's API (`api-off`, `scope`, `mailbox`); null for others */
  problemOf: (err: unknown) => string | null
  /** The id of an event stored before rows kept ids, for an app whose ids follow from the uid */
  idOf?: ((uid: string) => string) | undefined
}
