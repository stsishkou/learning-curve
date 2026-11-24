// Node-only: signing in to a calendar app with the person's own OAuth client. The client and the refresh token live in
// the untracked `data/local.json`, under the app's name, and never leave the server.
import { createHash, randomBytes } from 'node:crypto'

import type { CalendarProvider } from '@lc/plan-domain'

import { readLocal, writeLocal } from '../store'
import { kitOf } from './providers'

const PENDING_FOR = 10 * 60_000
const TIMEOUT = 15_000

/**
 * Why signing in did not work: no client saved or the app refused it, a sign-in that expired or is not this one, one
 * to redo, or access to the calendars left out on the app's page.
 */
export class CalendarAuthError extends Error {
  readonly reason: 'client' | 'state' | 'reconnect' | 'token' | 'scope'

  constructor(reason: CalendarAuthError['reason'], detail = '') {
    super(`Calendar sign-in: ${reason}${detail ? ` (${detail})` : ''}`)
    this.reason = reason
  }
}

interface Pending {
  state: string
  verifier: string
  redirect: string
  at: number
}

interface Account {
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

function readAccount(provider: CalendarProvider): Account {
  const account = readLocal()[provider]
  const pending = field(account, 'pending')
  const state = text(field(pending, 'state'))
  const verifier = text(field(pending, 'verifier'))
  const redirect = text(field(pending, 'redirect'))
  const at = field(pending, 'at')
  const since = field(account, 'connectedAt')
  return {
    clientId: text(field(account, 'clientId')),
    clientSecret: text(field(account, 'clientSecret')),
    refreshToken: text(field(account, 'refreshToken')),
    connectedAt: typeof since === 'number' ? since : undefined,
    pending: state && verifier && redirect && typeof at === 'number' ? { state, verifier, redirect, at } : undefined,
  }
}

const writeAccount = (provider: CalendarProvider, patch: Account) =>
  writeLocal({ [provider]: { ...readAccount(provider), ...patch } })

/** The OAuth client: the one set in the app's environment variables, otherwise the one saved here. */
export function calendarClient(provider: CalendarProvider): { id: string; secret: string } | null {
  const { env } = kitOf(provider).auth
  const saved = readAccount(provider)
  const id = text(process.env[env.id]) ?? saved.clientId
  const secret = text(process.env[env.secret]) ?? saved.clientSecret
  return id && secret ? { id, secret } : null
}

export const saveCalendarClient = (provider: CalendarProvider, id: string, secret: string) =>
  writeAccount(provider, { clientId: id.trim(), clientSecret: secret.trim() })

/** When the account was connected; null when it is not. */
export function connectedAt(provider: CalendarProvider): number | null {
  const { refreshToken, connectedAt: at } = readAccount(provider)
  return refreshToken ? (at ?? 0) : null
}

const base64url = (bytes: Buffer) => bytes.toString('base64url')

/**
 * The app's sign-in page for this client, coming back to `redirect` with a code. PKCE and a one-time state tie the
 * answer to this request.
 */
export function connectAddress(provider: CalendarProvider, redirect: string): string {
  const { auth } = kitOf(provider)
  const client = calendarClient(provider)
  if (!client) throw new CalendarAuthError('client')
  const state = base64url(randomBytes(24))
  const verifier = base64url(randomBytes(48))
  writeAccount(provider, { pending: { state, verifier, redirect, at: Date.now() } })
  const url = new URL(auth.authorize)
  url.search = new URLSearchParams({
    client_id: client.id,
    redirect_uri: redirect,
    response_type: 'code',
    scope: auth.scope,
    ...auth.page,
    state,
    code_challenge: base64url(createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
  }).toString()
  return url.href
}

const cached = new Map<CalendarProvider, { token: string; until: number }>()

async function tokenRequest(provider: CalendarProvider, params: Record<string, string>) {
  const { auth } = kitOf(provider)
  const client = calendarClient(provider)
  if (!client) throw new CalendarAuthError('client')
  const response = await fetch(auth.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client.id,
      client_secret: client.secret,
      ...(auth.scopeOnToken ? { scope: auth.scope } : {}),
      ...params,
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  })
  const data: unknown = await response.json().catch(() => null)
  const error = text(field(data, 'error'))
  if (!response.ok) {
    const refused = error === 'invalid_client' || error === 'unauthorized_client'
    throw new CalendarAuthError(error === 'invalid_grant' ? 'reconnect' : refused ? 'client' : 'token', error)
  }
  const token = text(field(data, 'access_token'))
  const expires = field(data, 'expires_in')
  if (!token) throw new CalendarAuthError('token', 'no access token')
  cached.set(provider, { token, until: Date.now() + (typeof expires === 'number' ? expires - 60 : 0) * 1000 })
  return { token, refresh: text(field(data, 'refresh_token')), scope: text(field(data, 'scope')) }
}

/** Finishes the sign-in `connectAddress` started, keeping the refresh token the app gives for it. */
export async function finishConnect(provider: CalendarProvider, code: string, state: string): Promise<void> {
  const { pending } = readAccount(provider)
  if (!pending || pending.state !== state || Date.now() - pending.at > PENDING_FOR) {
    throw new CalendarAuthError('state')
  }
  writeAccount(provider, { pending: undefined })
  const { refresh, scope } = await tokenRequest(provider, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: pending.redirect,
    code_verifier: pending.verifier,
  })
  // The app's page may let the person untick access to the calendars; the sign-in is then of no use.
  if (scope && !kitOf(provider).auth.granted(scope)) throw new CalendarAuthError('scope')
  if (!refresh) throw new CalendarAuthError('token', 'no refresh token')
  writeAccount(provider, { refreshToken: refresh, connectedAt: Date.now() })
}

/**
 * A token for the app's API, kept until a minute before it expires; `renew` gets a new one after a 401. A refresh
 * token that comes back renewed replaces the old one; one the app no longer takes is forgotten, so the planner asks to
 * connect again.
 */
export async function accessToken(provider: CalendarProvider, renew = false): Promise<string> {
  const kept = cached.get(provider)
  if (!renew && kept && kept.until > Date.now()) return kept.token
  const { refreshToken } = readAccount(provider)
  if (!refreshToken) throw new CalendarAuthError('reconnect')
  try {
    const { token, refresh } = await tokenRequest(provider, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    if (refresh && refresh !== refreshToken) writeAccount(provider, { refreshToken: refresh })
    return token
  } catch (err) {
    if (err instanceof CalendarAuthError && err.reason === 'reconnect')
      writeAccount(provider, { refreshToken: undefined })
    throw err
  }
}

/** Signs out here and, where the app can be told, has it forget the grant; the calendars there stay as they are. */
export async function disconnectCalendar(provider: CalendarProvider): Promise<void> {
  const { refreshToken } = readAccount(provider)
  writeAccount(provider, { refreshToken: undefined, connectedAt: undefined, pending: undefined })
  cached.delete(provider)
  const { revoke } = kitOf(provider).auth
  if (!refreshToken || !revoke) return
  await fetch(revoke, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => undefined)
}
