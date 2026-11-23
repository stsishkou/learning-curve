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
  /** Edits made in Google, waiting for the person */
  inbox: InboxItem[]
  /** When the last round ended, UTC epoch ms */
  lastRound: number | null
  /** `reconnect` when Google ended the sign-in; otherwise what failed */
  error: string | null
}

/** The Google sync as the host offers it. Every call rejects with the reason when it fails. */
export interface GoogleSyncSource {
  status: GoogleSyncStatus
  /** Where the browser goes to sign in to Google */
  connectUrl: string
  saveClient: (id: string, secret: string) => Promise<void>
  /** One round now: reads Google, writes the plan; resolves with the state after it */
  sync: () => Promise<GoogleSyncStatus>
  /** Takes Google's version of these proposals into the plan; resolves once the plan is fresh */
  accept: (ids: string[]) => Promise<GoogleSyncStatus>
  /** Writes the plan's version back over these proposals */
  reject: (ids: string[]) => Promise<GoogleSyncStatus>
  disconnect: () => Promise<void>
}
