import { createHash, randomBytes } from 'node:crypto'
import { join } from 'node:path'

import type { CalendarProvider } from '@lc/plan-domain'
import { CalendarAuthError, type CalendarConnector, type CalendarSignIn, type CalendarTokens } from '@lc/plan-service'

import { readObject, writeJsonAtomic } from './files'

const PENDING_FOR = 10 * 60_000
const TIMEOUT = 15_000

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
const base64url = (bytes: Buffer) => bytes.toString('base64url')

/** What the host sets of a calendar app's OAuth client; a field left empty falls back to the saved one. */
export type HostClients = Partial<Record<CalendarProvider, { readonly id: string; readonly secret: string }>>

/**
 * The host's account in each calendar app, signed in with the person's own OAuth client: the client and the refresh
 * token are kept under the app's name in `local.json`, readable by its owner only, and never leave the server. One
 * account per app for the whole host, whichever owner a token is asked for.
 *
 * Beyond the ports: the file is replaced by a rename and keeps every other setting in it; access tokens are kept in
 * memory, per process, until a minute before they expire.
 */
export function createFsCalendarAccounts(
  dir: string,
  connectors: Readonly<Record<CalendarProvider, CalendarConnector>>,
  clientsFromHost: HostClients,
): { readonly signIn: CalendarSignIn; readonly tokens: CalendarTokens } {
  const file = join(dir, 'local.json')
  const cached = new Map<CalendarProvider, { token: string; until: number }>()

  function readAccount(provider: CalendarProvider): Account {
    const account = readObject(file)[provider]
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

  function writeAccount(provider: CalendarProvider, patch: Account) {
    writeJsonAtomic(file, { ...readObject(file), [provider]: { ...readAccount(provider), ...patch } }, 0o600)
  }

  function clientOf(provider: CalendarProvider): { id: string; secret: string } | null {
    const host = clientsFromHost[provider]
    const saved = readAccount(provider)
    const id = text(host?.id) ?? saved.clientId
    const secret = text(host?.secret) ?? saved.clientSecret
    return id && secret ? { id, secret } : null
  }

  function connectedAt(provider: CalendarProvider): number | null {
    const { refreshToken, connectedAt: at } = readAccount(provider)
    return refreshToken ? (at ?? 0) : null
  }

  async function tokenRequest(provider: CalendarProvider, params: Record<string, string>) {
    const { auth } = connectors[provider]
    const client = clientOf(provider)
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

  const signIn: CalendarSignIn = {
    status: (provider) =>
      Promise.resolve({ configured: clientOf(provider) !== null, connectedAt: connectedAt(provider) }),

    saveClient: (provider, id, secret) => {
      writeAccount(provider, { clientId: id.trim(), clientSecret: secret.trim() })
      return Promise.resolve()
    },

    // PKCE and a one-time state tie the app's answer to this request.
    connectAddress: (provider, redirect) => {
      const { auth } = connectors[provider]
      const client = clientOf(provider)
      if (!client) return Promise.reject(new CalendarAuthError('client'))
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
      return Promise.resolve(url.href)
    },

    finishConnect: async (provider, code, state) => {
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
      if (scope && !connectors[provider].auth.granted(scope)) throw new CalendarAuthError('scope')
      if (!refresh) throw new CalendarAuthError('token', 'no refresh token')
      writeAccount(provider, { refreshToken: refresh, connectedAt: Date.now() })
    },

    disconnect: async (provider) => {
      const { refreshToken } = readAccount(provider)
      writeAccount(provider, { refreshToken: undefined, connectedAt: undefined, pending: undefined })
      cached.delete(provider)
      const { revoke } = connectors[provider].auth
      if (!refreshToken || !revoke) return
      await fetch(revoke, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }),
        signal: AbortSignal.timeout(TIMEOUT),
      }).catch(() => undefined)
    },
  }

  // A refresh token that comes back renewed replaces the old one; one the app no longer takes is forgotten, so the
  // planner asks to connect again.
  const tokens: CalendarTokens = {
    token: async (_owner, provider, renew) => {
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
    },
  }

  return { signIn, tokens }
}
