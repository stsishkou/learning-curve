// Node-only: signing in to Google for the calendar sync. The client and the refresh token live in the untracked
// `data/local.json` and never leave the server.
import { createHash, randomBytes } from 'node:crypto'

import { readLocal, writeLocal } from '../store'

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const REVOKE = 'https://oauth2.googleapis.com/revoke'
/** Only the calendars the app makes, and their events: nothing else in the account, not even its address */
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'
const PENDING_FOR = 10 * 60_000
const TIMEOUT = 15_000

/** Why signing in did not work: no client saved, a sign-in that expired or is not this one, or one to redo. */
export class GoogleAuthError extends Error {
  readonly reason: 'client' | 'state' | 'reconnect' | 'token'

  constructor(reason: GoogleAuthError['reason'], detail = '') {
    super(`Google sign-in: ${reason}${detail ? ` (${detail})` : ''}`)
    this.reason = reason
  }
}

interface Pending {
  state: string
  verifier: string
  redirect: string
  at: number
}

interface GoogleLocal {
  clientId?: string | undefined
  clientSecret?: string | undefined
  refreshToken?: string | undefined
  connectedAt?: number | undefined
  /** A sign-in started and not finished yet */
  pending?: Pending | undefined
}

const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const field = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined)

function readGoogle(): GoogleLocal {
  const google = readLocal().google
  const pending = field(google, 'pending')
  const state = text(field(pending, 'state'))
  const verifier = text(field(pending, 'verifier'))
  const redirect = text(field(pending, 'redirect'))
  const at = field(pending, 'at')
  const connectedAt = field(google, 'connectedAt')
  return {
    clientId: text(field(google, 'clientId')),
    clientSecret: text(field(google, 'clientSecret')),
    refreshToken: text(field(google, 'refreshToken')),
    connectedAt: typeof connectedAt === 'number' ? connectedAt : undefined,
    pending: state && verifier && redirect && typeof at === 'number' ? { state, verifier, redirect, at } : undefined,
  }
}

const writeGoogle = (patch: GoogleLocal) => writeLocal({ google: { ...readGoogle(), ...patch } })

/** The OAuth client: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` when set, otherwise the one saved here. */
export function googleClient(): { id: string; secret: string } | null {
  const saved = readGoogle()
  const id = text(process.env.GOOGLE_CLIENT_ID) ?? saved.clientId
  const secret = text(process.env.GOOGLE_CLIENT_SECRET) ?? saved.clientSecret
  return id && secret ? { id, secret } : null
}

export const saveGoogleClient = (id: string, secret: string) =>
  writeGoogle({ clientId: id.trim(), clientSecret: secret.trim() })

/** When the account was connected; null when it is not. */
export function googleConnectedAt(): number | null {
  const { refreshToken, connectedAt } = readGoogle()
  return refreshToken ? (connectedAt ?? 0) : null
}

const base64url = (bytes: Buffer) => bytes.toString('base64url')

/**
 * Google's sign-in page for this client, coming back to `redirect` with a code. PKCE and a one-time state tie the
 * answer to this request; asking for consent every time makes Google hand out a refresh token every time.
 */
export function connectAddress(redirect: string): string {
  const client = googleClient()
  if (!client) throw new GoogleAuthError('client')
  const state = base64url(randomBytes(24))
  const verifier = base64url(randomBytes(48))
  writeGoogle({ pending: { state, verifier, redirect, at: Date.now() } })
  const url = new URL(AUTH)
  url.search = new URLSearchParams({
    client_id: client.id,
    redirect_uri: redirect,
    response_type: 'code',
    scope: GOOGLE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: base64url(createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
  }).toString()
  return url.href
}

let cached: { token: string; until: number } | null = null

async function tokenRequest(params: Record<string, string>) {
  const client = googleClient()
  if (!client) throw new GoogleAuthError('client')
  const response = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: client.id, client_secret: client.secret, ...params }),
    signal: AbortSignal.timeout(TIMEOUT),
  })
  const data: unknown = await response.json().catch(() => null)
  const error = text(field(data, 'error'))
  if (!response.ok) throw new GoogleAuthError(error === 'invalid_grant' ? 'reconnect' : 'token', error)
  const token = text(field(data, 'access_token'))
  const expires = field(data, 'expires_in')
  if (!token) throw new GoogleAuthError('token', 'no access token')
  cached = { token, until: Date.now() + (typeof expires === 'number' ? expires - 60 : 0) * 1000 }
  return { token, refresh: text(field(data, 'refresh_token')) }
}

/** Finishes the sign-in `connectAddress` started, keeping the refresh token Google gives for it. */
export async function finishConnect(code: string, state: string): Promise<void> {
  const { pending } = readGoogle()
  if (!pending || pending.state !== state || Date.now() - pending.at > PENDING_FOR) throw new GoogleAuthError('state')
  writeGoogle({ pending: undefined })
  const { refresh } = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: pending.redirect,
    code_verifier: pending.verifier,
  })
  if (!refresh) throw new GoogleAuthError('token', 'no refresh token')
  writeGoogle({ refreshToken: refresh, connectedAt: Date.now() })
}

/**
 * A token for the Calendar API, kept until a minute before it expires; `renew` gets a new one after a 401. A refresh
 * token Google no longer takes is forgotten, so the app asks to connect again.
 */
export async function accessToken(renew = false): Promise<string> {
  if (!renew && cached && cached.until > Date.now()) return cached.token
  const { refreshToken } = readGoogle()
  if (!refreshToken) throw new GoogleAuthError('reconnect')
  try {
    const { token } = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
    return token
  } catch (err) {
    if (err instanceof GoogleAuthError && err.reason === 'reconnect') writeGoogle({ refreshToken: undefined })
    throw err
  }
}

/** Signs out here and tells Google to forget the grant; the calendars in Google stay as they are. */
export async function disconnectGoogle(): Promise<void> {
  const { refreshToken } = readGoogle()
  writeGoogle({ refreshToken: undefined, connectedAt: undefined, pending: undefined })
  cached = null
  if (!refreshToken) return
  await fetch(REVOKE, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => undefined)
}
