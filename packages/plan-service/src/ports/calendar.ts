import type { CalendarProvider, Plan, UserId } from '@lc/plan-domain'
import type { RemoteEvent, SyncCalendarRow, SyncRow, SyncState, Written } from '@lc/plan-domain/sync'

/** An event as the app stored it: its id there and its version. */
export interface Saved {
  readonly id: string
  readonly etag: string
}

/**
 * One calendar app's API calls for one round of the sync, already in the sync rules' terms. A call the app refuses
 * rejects with the app's own error, which the connector's `problemOf` names.
 */
export interface CalendarAdapter {
  /** Makes a calendar and returns its id */
  readonly insertCalendar: (name: string) => Promise<string>
  readonly renameCalendar: (id: string, name: string) => Promise<void>
  /** Best effort: a calendar the app may not delete stays, empty */
  readonly deleteCalendar: (id: string) => Promise<void>
  /**
   * What the calendar `row` says now, or what changed in it since `row.cursor`, with where the reading ended;
   * `missing` when the calendar is gone.
   */
  readonly readCalendar: (
    row: SyncCalendarRow,
    plan: Plan,
    state: SyncState,
  ) => Promise<{ readonly events: readonly RemoteEvent[]; readonly cursor?: string | undefined } | 'missing'>
  /** The event `uid` was written as, as it is now; null when it is gone */
  readonly getEvent: (uid: string, row: SyncRow) => Promise<RemoteEvent | null>
  readonly insertEvent: (calendar: string, uid: string, written: Written) => Promise<Saved>
  /** `conflict` when the event changed in the app since `row.etag`; `missing` when it is not there */
  readonly patchEvent: (uid: string, row: SyncRow, written: Written) => Promise<Saved | 'conflict' | 'missing'>
  /** Moves the event to calendar `to`; `written` is what it should say there */
  readonly moveEvent: (uid: string, row: SyncRow, to: string, written: Written) => Promise<Saved | 'missing'>
  readonly deleteEvent: (calendar: string, id: string) => Promise<void>
  /**
   * Puts repeat `source` of the series `row` back on its slot. `gone` when that took deleting the series, which the
   * next round writes again.
   */
  readonly restoreRepeat: (
    row: SyncRow,
    source: string,
    slot: { readonly start: string; readonly end: string },
  ) => Promise<'done' | 'gone'>
}

/**
 * How a calendar app signs a person in: OAuth 2.0 with the authorization code, PKCE and the person's own client.
 * Where a host sets the client is the host's business, not the app's.
 */
export interface OAuthConfig {
  readonly authorize: string
  readonly token: string
  /** Where a refresh token is revoked; absent when the app has no such endpoint */
  readonly revoke?: string | undefined
  readonly scope: string
  /** More parameters of the sign-in page */
  readonly page: Readonly<Record<string, string>>
  /** The scope is sent with the token requests too */
  readonly scopeOnToken: boolean
  /** Whether the scope a sign-in granted covers the calendars */
  readonly granted: (scope: string) => boolean
}

/**
 * What stopped the last round of the sync, in words the planner turns into advice: the sign-in ended, the client was
 * refused, access to the calendars was not granted, the app was out of reach; for Google, the Calendar API is off in
 * the person's Cloud project; for Outlook, the account has no mailbox Graph can reach.
 */
export type CalendarProblem = 'reconnect' | 'client' | 'scope' | 'offline' | 'api-off' | 'mailbox'

/**
 * Why signing in to a calendar app did not work: no client saved or the app refused it, a sign-in that expired or is
 * not this one, one to redo, or access to the calendars left out on the app's page.
 */
export class CalendarAuthError extends Error {
  readonly reason: 'client' | 'state' | 'reconnect' | 'token' | 'scope'

  constructor(reason: CalendarAuthError['reason'], detail = '') {
    super(`Calendar sign-in: ${reason}${detail ? ` (${detail})` : ''}`)
    this.reason = reason
  }
}

/**
 * One calendar app the plan can be kept in, as the sync needs it: its sign-in, its API calls and how to read its
 * errors. It holds no secret and no state; a token comes from `CalendarTokens`.
 */
export interface CalendarConnector {
  readonly provider: CalendarProvider
  readonly auth: OAuthConfig
  /** The app's calls, with `token` giving an access token, a new one when `renew` is set */
  readonly adapter: (token: (renew: boolean) => Promise<string>, timeZone: string) => CalendarAdapter
  /** The problem the planner explains for an error of the app's API; null for an error it does not know */
  readonly problemOf: (err: unknown) => CalendarProblem | null
  /** The id of an event stored before the sync kept ids, for an app whose ids follow from the uid */
  readonly idOf?: ((uid: string) => string) | undefined
}

/**
 * Connecting the host to a calendar app with the person's own OAuth client. One account per host until phase 3:
 * whoever connects it, every plan on the host is kept in that account.
 *
 * In every implementation the client secret and the refresh token stay on the server; a client the host sets wins
 * over a saved one.
 */
export interface CalendarSignIn {
  readonly status: (provider: CalendarProvider) => Promise<{
    /** A client id and secret are known, the host's or a saved one */
    readonly configured: boolean
    /** When the account was connected; null when it is not */
    readonly connectedAt: number | null
  }>
  /**
   * Keeps the client, trimmed, for the next sign-in. Called only where the store can be written: the service checks
   * `host.writable()` first.
   */
  readonly saveClient: (provider: CalendarProvider, id: string, secret: string) => Promise<void>
  /**
   * The app's sign-in page for the client, coming back to `redirect` with a code. Starts a one-time sign-in, which
   * expires unless `finishConnect` finishes it soon. Rejects with `CalendarAuthError` `client` when no client is
   * known. Called only where the store can be written.
   */
  readonly connectAddress: (provider: CalendarProvider, redirect: string) => Promise<string>
  /**
   * Finishes the sign-in `connectAddress` started and keeps the account. Rejects with `CalendarAuthError`: `state`
   * for a sign-in that expired or is not this one, `scope` when access to the calendars was left out, `client`,
   * `reconnect` or `token` when the app refused. Called only where the store can be written.
   */
  readonly finishConnect: (provider: CalendarProvider, code: string, state: string) => Promise<void>
  /**
   * Signs out here and, where the app can be told, has it forget the grant; the calendars there stay as they are.
   * Signing out here works even when the app cannot be reached. Called only where the store can be written.
   */
  readonly disconnect: (provider: CalendarProvider) => Promise<void>
}

/** An access token to a person's account in a calendar app. */
export interface CalendarTokens {
  /**
   * A token for `owner`'s account in `provider`'s API, reused until shortly before it expires; `renew` gets a new
   * one, after the app refused the last. Rejects with `CalendarAuthError` `reconnect` when the account must be
   * connected again (it is then forgotten) and `client` when no client is known or the app refuses it; other
   * failures reject as they come. Asked only by a round or a decision, which run only where the store can be
   * written, since a renewed token is kept.
   */
  readonly token: (owner: UserId, provider: CalendarProvider, renew: boolean) => Promise<string>
}
