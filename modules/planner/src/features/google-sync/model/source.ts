import type { InboxItem } from '@lc/plan-domain'

/** What the host says about keeping the plan in Google Calendar; nothing secret. */
export interface GoogleSyncStatus {
  /** False where the plan cannot be changed, and nothing is synced */
  writable: boolean
  /** An OAuth client is saved */
  configured: boolean
  /** When the account was connected, UTC epoch ms; null when it is not */
  connectedAt: number | null
  calendars: number
  events: number
  /** Edits made in Google that wait for a decision: the planner changed the same thing, or the plan cannot take them */
  inbox: InboxItem[]
  /** When the last round ended, UTC epoch ms */
  lastRound: number | null
  /** When an edit made in Google was last taken into the plan, UTC epoch ms */
  takenAt: number | null
  /** A problem the dialog explains (`reconnect`, `client`, `api-off`, `scope`, `offline`), or what failed */
  error: string | null
}

/** How a sign-in to Google came back to the planner. */
export const SIGN_IN_ENDS = ['connected', 'failed', 'denied', 'scope', 'client'] as const
export type SignInEnd = (typeof SIGN_IN_ENDS)[number]

/** The Google sync as the host offers it. Every call rejects with the reason when it fails. */
export interface GoogleSyncSource {
  status: GoogleSyncStatus
  /** Where the browser goes to sign in to Google */
  connectUrl: string
  /** Where Google's sign-in comes back, on the address the planner is open at: the client's redirect URI */
  callbackPath: string
  saveClient: (id: string, secret: string) => Promise<void>
  /** One round now: reads Google, writes the plan; resolves with the state after it, and the plan read again if it changed */
  sync: () => Promise<GoogleSyncStatus>
  /** Takes Google's version of these held edits into the plan; resolves once the plan is fresh */
  accept: (ids: string[]) => Promise<GoogleSyncStatus>
  /** Writes the plan's version back over these held edits */
  reject: (ids: string[]) => Promise<GoogleSyncStatus>
  disconnect: () => Promise<void>
}
