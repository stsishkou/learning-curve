import type { CalendarProvider, InboxItem } from '@lc/plan-domain'

/** What the host says about keeping the plan in one calendar app; nothing secret. */
export interface CalendarSyncStatus {
  provider: CalendarProvider
  /** False where the plan cannot be changed, and nothing is synced */
  writable: boolean
  /** An OAuth client is saved */
  configured: boolean
  /** When the account was connected, UTC epoch ms; null when it is not */
  connectedAt: number | null
  calendars: number
  events: number
  /** Edits made in the app that wait for a decision: the planner changed the same thing, or the plan cannot take them */
  inbox: InboxItem[]
  /** When the last round ended, UTC epoch ms */
  lastRound: number | null
  /** When an edit made in the app was last taken into the plan, UTC epoch ms */
  takenAt: number | null
  /**
   * A problem the dialog explains (`reconnect`, `client`, `scope`, `offline`; `api-off` for Google, `mailbox` for
   * Outlook), or what failed
   */
  error: string | null
}

/** How a sign-in to a calendar app came back to the planner. */
export const SIGN_IN_ENDS = ['connected', 'failed', 'denied', 'scope', 'client'] as const
export type SignInEnd = (typeof SIGN_IN_ENDS)[number]

/** One calendar app as the host offers it. Every call rejects with the reason when it fails. */
export interface CalendarSyncSource {
  status: CalendarSyncStatus
  /** Where the browser goes to sign in to the app */
  connectUrl: string
  /** Where the app's sign-in comes back, on the address the planner is open at: the client's redirect URI */
  callbackPath: string
  saveClient: (id: string, secret: string) => Promise<void>
  /** One round now: reads the app, writes the plan; resolves with the state after it, and the plan read again if it changed */
  sync: () => Promise<CalendarSyncStatus>
  /** Takes the app's version of these held edits into the plan; resolves once the plan is fresh */
  accept: (ids: string[]) => Promise<CalendarSyncStatus>
  /** Writes the plan's version back over these held edits */
  reject: (ids: string[]) => Promise<CalendarSyncStatus>
  disconnect: () => Promise<void>
}

/**
 * Whether an app's sync asks for the person: edits wait for a decision, or something stopped it that is theirs to
 * fix. Being offline is not: the planner tries again by itself.
 */
export function attentionOf(status: CalendarSyncStatus): 'waiting' | 'problem' | null {
  if (status.inbox.length) return 'waiting'
  const { error, connectedAt } = status
  if (!error || error === 'offline') return null
  return connectedAt !== null || error === 'reconnect' ? 'problem' : null
}

/** A held edit, with the app it was made in. */
export interface HeldEdit extends InboxItem {
  provider: CalendarProvider
}
