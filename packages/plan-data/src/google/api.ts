// Node-only: the few Google Calendar API calls the sync makes, over `fetch`.
import type { GoogleBody, GoogleEvent } from '@lc/plan-domain'

const API = 'https://www.googleapis.com/calendar/v3'
const TIMEOUT = 20_000
const TRIES = 5
const PAGE = 250
const SLOWED = new Set(['rateLimitExceeded', 'userRateLimitExceeded'])

export class GoogleApiError extends Error {
  readonly status: number
  readonly reason: string

  constructor(status: number, reason: string) {
    super(`Google Calendar answered ${status}${reason ? ` (${reason})` : ''}`)
    this.status = status
    this.reason = reason
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isEvent = (value: unknown): value is GoogleEvent => isRecord(value) && typeof value.id === 'string'
const text = (value: unknown) => (typeof value === 'string' ? value : '')

function reasonOf(data: unknown): string {
  const error = isRecord(data) ? data.error : null
  const errors = isRecord(error) && Array.isArray(error.errors) ? error.errors : []
  const first: unknown = errors[0]
  return isRecord(first) ? text(first.reason) : ''
}

/** Google's advice: back off exponentially, varied by ±25 %. */
const backoff = (attempt: number) => Math.min(32_000, 1000 * 2 ** attempt) * (0.75 + Math.random() * 0.5)
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

interface Call {
  query?: Record<string, string | undefined>
  body?: unknown
  ifMatch?: string
  /** Statuses that are answers here rather than failures */
  accept?: number[]
}

/** What changed in one calendar since `syncToken`: `gone` when the token expired, `missing` when the calendar did. */
export type Listing = { items: GoogleEvent[]; syncToken: string } | 'gone' | 'missing'

interface Answer {
  status: number
  data: unknown
}

export class GoogleCalendarApi {
  private readonly token: (renew: boolean) => Promise<string>
  private readonly wait: (ms: number) => Promise<void>

  /** `token` gives the access token, a new one when `renew` is set after Google refused the last. */
  constructor(token: (renew: boolean) => Promise<string>, wait: (ms: number) => Promise<void> = pause) {
    this.token = token
    this.wait = wait
  }

  private async send(method: string, path: string, call: Call = {}, attempt = 0, renew = false): Promise<Answer> {
    const url = new URL(`${API}${path}`)
    for (const [key, value] of Object.entries(call.query ?? {}))
      if (value !== undefined) url.searchParams.set(key, value)
    const headers: Record<string, string> = { authorization: `Bearer ${await this.token(renew)}` }
    if (call.body !== undefined) headers['content-type'] = 'application/json'
    if (call.ifMatch) headers['if-match'] = call.ifMatch
    const response = await fetch(url, {
      method,
      headers,
      ...(call.body === undefined ? {} : { body: JSON.stringify(call.body) }),
      signal: AbortSignal.timeout(TIMEOUT),
    })
    const data: unknown = await response.json().catch(() => null)
    if (response.ok || call.accept?.includes(response.status)) return { status: response.status, data }
    const reason = reasonOf(data)
    const last = attempt === TRIES - 1
    if (response.status === 401 && !renew && !last) return this.send(method, path, call, attempt + 1, true)
    const slowed = response.status === 429 || response.status >= 500 || (response.status === 403 && SLOWED.has(reason))
    if (!slowed || last) throw new GoogleApiError(response.status, reason)
    await this.wait(backoff(attempt))
    return this.send(method, path, call, attempt + 1)
  }

  private async event(method: string, path: string, call: Call): Promise<GoogleEvent> {
    const { data } = await this.send(method, path, call)
    if (!isEvent(data)) throw new GoogleApiError(200, 'not an event')
    return data
  }

  async insertCalendar(summary: string, timeZone: string): Promise<string> {
    const { data } = await this.send('POST', '/calendars', { body: { summary, timeZone } })
    const id = isRecord(data) ? text(data.id) : ''
    if (!id) throw new GoogleApiError(200, 'no calendar id')
    return id
  }

  async patchCalendar(id: string, summary: string): Promise<void> {
    await this.send('PATCH', `/calendars/${encodeURIComponent(id)}`, { body: { summary } })
  }

  /** Best effort: the narrow scope may not cover deleting a calendar, which then stays in the account, empty. */
  async deleteCalendar(id: string): Promise<void> {
    await this.send('DELETE', `/calendars/${encodeURIComponent(id)}`, { accept: [403, 404, 410] })
  }

  /** Every page of the changes since `syncToken`; without one, every event, deleted ones included. */
  listEvents(calendar: string, syncToken?: string): Promise<Listing> {
    return this.page(calendar, syncToken, undefined, [])
  }

  private async page(
    calendar: string,
    syncToken: string | undefined,
    pageToken: string | undefined,
    items: GoogleEvent[],
  ): Promise<Listing> {
    const { status, data } = await this.send('GET', `/calendars/${encodeURIComponent(calendar)}/events`, {
      query: { maxResults: String(PAGE), ...(syncToken ? { syncToken } : { showDeleted: 'true' }), pageToken },
      accept: [404, 410],
    })
    if (status === 410) return 'gone'
    if (status === 404) return 'missing'
    const page = isRecord(data) ? data : {}
    const found = [...items, ...(Array.isArray(page.items) ? page.items.filter(isEvent) : [])]
    const next = text(page.nextPageToken)
    return next ? this.page(calendar, syncToken, next, found) : { items: found, syncToken: text(page.nextSyncToken) }
  }

  async getEvent(calendar: string, id: string): Promise<GoogleEvent | null> {
    const path = `/calendars/${encodeURIComponent(calendar)}/events/${id}`
    const { status, data } = await this.send('GET', path, { accept: [404, 410] })
    return status < 300 && isEvent(data) ? data : null
  }

  /** Writes a new event under its own id; one that is there already, even deleted, is written over and brought back. */
  async insertEvent(calendar: string, body: GoogleBody): Promise<GoogleEvent> {
    const events = `/calendars/${encodeURIComponent(calendar)}/events`
    const { status, data } = await this.send('POST', events, { body, accept: [409] })
    if (status !== 409 && isEvent(data)) return data
    return this.event('PUT', `${events}/${body.id}`, { body: { ...body, status: 'confirmed' } })
  }

  /** `conflict` when the event changed in Google since `etag`; `missing` when it is not there. */
  async patchEvent(
    calendar: string,
    id: string,
    body: Partial<GoogleBody> & { status?: string },
    etag?: string,
  ): Promise<GoogleEvent | 'conflict' | 'missing'> {
    const path = `/calendars/${encodeURIComponent(calendar)}/events/${id}`
    const { status, data } = await this.send('PATCH', path, {
      body,
      ...(etag ? { ifMatch: etag } : {}),
      accept: [404, 410, 412],
    })
    if (status === 412) return 'conflict'
    return status < 300 && isEvent(data) ? data : 'missing'
  }

  async deleteEvent(calendar: string, id: string): Promise<void> {
    await this.send('DELETE', `/calendars/${encodeURIComponent(calendar)}/events/${id}`, { accept: [404, 410] })
  }

  async moveEvent(calendar: string, id: string, destination: string): Promise<GoogleEvent | 'missing'> {
    const path = `/calendars/${encodeURIComponent(calendar)}/events/${id}/move`
    const { status, data } = await this.send('POST', path, { query: { destination }, accept: [404, 410] })
    return status < 300 && isEvent(data) ? data : 'missing'
  }
}
