// Node-only: the few Microsoft Graph calls the Outlook sync makes, over `fetch`.
import { randomUUID } from 'node:crypto'

import type { GraphBody, GraphEvent } from '@lc/plan-domain'

const API = 'https://graph.microsoft.com/v1.0'
const TIMEOUT = 20_000
const TRIES = 5
const PAGE = 100
const FIELDS = 'id,changeKey,subject,start,end,isAllDay,isCancelled,type,seriesMasterId,originalStart'

export class OutlookApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(`Outlook answered ${status}${code ? ` (${code})` : ''}`)
    this.status = status
    this.code = code
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isEvent = (value: unknown): value is GraphEvent => isRecord(value) && typeof value.id === 'string'
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const codeOf = (data: unknown) => text(isRecord(data) && isRecord(data.error) ? data.error.code : '')

interface Answer {
  status: number
  data: unknown
}

/**
 * Whether a 404 means the item is not there. Graph answers 404 for an account without a mailbox too: that one is a
 * failure, or a round would take every calendar for deleted.
 */
function gone({ status, data }: Answer): boolean {
  if (status !== 404) return false
  const code = codeOf(data)
  if (code && code !== 'ErrorItemNotFound') throw new OutlookApiError(status, code)
  return true
}

/** Graph's advice: wait as long as `Retry-After` says, otherwise back off exponentially. */
const backoff = (attempt: number, retryAfter: string | null) =>
  retryAfter && Number(retryAfter) > 0 ? Number(retryAfter) * 1000 : Math.min(32_000, 1000 * 2 ** attempt)
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

interface Call {
  query?: Record<string, string>
  body?: unknown
  /** Statuses that are answers here rather than failures */
  accept?: number[]
}

export class OutlookCalendarApi {
  private readonly token: (renew: boolean) => Promise<string>
  private readonly zone: string
  private readonly wait: (ms: number) => Promise<void>

  /**
   * `token` gives the access token, a new one when `renew` is set after Graph refused the last; times come back in
   * `zone`, a name Graph takes.
   */
  constructor(token: (renew: boolean) => Promise<string>, zone: string, wait: (ms: number) => Promise<void> = pause) {
    this.token = token
    this.zone = zone
    this.wait = wait
  }

  /** `path` is under the API, or a whole `@odata.nextLink`. */
  private async send(method: string, path: string, call: Call = {}, attempt = 0, renew = false): Promise<Answer> {
    const url = new URL(path.startsWith('https://') ? path : `${API}${path}`)
    for (const [key, value] of Object.entries(call.query ?? {})) url.searchParams.set(key, value)
    const headers = new Headers({ authorization: `Bearer ${await this.token(renew)}` })
    // Ids that stay when an event changes, and times on the plan's clock.
    headers.append('prefer', 'IdType="ImmutableId"')
    headers.append('prefer', `outlook.timezone="${this.zone}"`)
    if (call.body !== undefined) headers.set('content-type', 'application/json')
    const response = await fetch(url, {
      method,
      headers,
      ...(call.body === undefined ? {} : { body: JSON.stringify(call.body) }),
      signal: AbortSignal.timeout(TIMEOUT),
    })
    const data: unknown = await response.json().catch(() => null)
    if (response.ok || call.accept?.includes(response.status)) return { status: response.status, data }
    const last = attempt === TRIES - 1
    if (response.status === 401 && !renew && !last) return this.send(method, path, call, attempt + 1, true)
    const slowed = response.status === 429 || response.status === 503 || response.status === 504
    if (!slowed || last) throw new OutlookApiError(response.status, codeOf(data))
    await this.wait(backoff(attempt, response.headers.get('retry-after')))
    return this.send(method, path, call, attempt + 1)
  }

  /** Every page of a listing; `missing` when what it lists is not there. */
  private async list(path: string, query: Record<string, string>): Promise<GraphEvent[] | 'missing'> {
    const items: GraphEvent[] = []
    let next: string | null = path
    let first = true
    while (next) {
      // oxlint-disable-next-line no-await-in-loop -- each page names the next one
      const answer = await this.send('GET', next, { ...(first ? { query } : {}), accept: [404] })
      if (gone(answer)) return 'missing'
      const page = isRecord(answer.data) ? answer.data : {}
      if (Array.isArray(page.value)) items.push(...page.value.filter(isEvent))
      next = text(page['@odata.nextLink']) || null
      first = false
    }
    return items
  }

  async insertCalendar(name: string): Promise<string> {
    const { data } = await this.send('POST', '/me/calendars', { body: { name } })
    const id = isRecord(data) ? text(data.id) : ''
    if (!id) throw new OutlookApiError(200, 'no calendar id')
    return id
  }

  async renameCalendar(id: string, name: string): Promise<void> {
    await this.send('PATCH', `/me/calendars/${encodeURIComponent(id)}`, { body: { name } })
  }

  /** Best effort: the main calendar, for one, cannot be deleted. */
  async deleteCalendar(id: string): Promise<void> {
    await this.send('DELETE', `/me/calendars/${encodeURIComponent(id)}`, { accept: [400, 403, 404] })
  }

  /** The single events and the series of a calendar, without their repeats. */
  listEvents(calendar: string): Promise<GraphEvent[] | 'missing'> {
    return this.list(`/me/calendars/${encodeURIComponent(calendar)}/events`, { $select: FIELDS, $top: String(PAGE) })
  }

  /** Everything a calendar shows from `start` to `end` (UTC instants), each repeat of a series on its own. */
  calendarView(calendar: string, start: string, end: string): Promise<GraphEvent[] | 'missing'> {
    return this.list(`/me/calendars/${encodeURIComponent(calendar)}/calendarView`, {
      startDateTime: start,
      endDateTime: end,
      $select: FIELDS,
      $top: String(PAGE),
    })
  }

  /** The repeats of series `id` from `start` to `end` (UTC instants). */
  async instances(id: string, start: string, end: string): Promise<GraphEvent[]> {
    const found = await this.list(`/me/events/${encodeURIComponent(id)}/instances`, {
      startDateTime: start,
      endDateTime: end,
      $select: FIELDS,
    })
    return found === 'missing' ? [] : found
  }

  async getEvent(id: string): Promise<GraphEvent | null> {
    const answer = await this.send('GET', `/me/events/${encodeURIComponent(id)}`, {
      query: { $select: FIELDS },
      accept: [404],
    })
    return !gone(answer) && isEvent(answer.data) ? answer.data : null
  }

  /** A retried request carries the same `transactionId`, so Graph makes the event once. */
  async insertEvent(calendar: string, body: GraphBody): Promise<GraphEvent> {
    const { data } = await this.send('POST', `/me/calendars/${encodeURIComponent(calendar)}/events`, {
      body: { ...body, transactionId: randomUUID() },
    })
    if (!isEvent(data)) throw new OutlookApiError(200, 'not an event')
    return data
  }

  async patchEvent(id: string, body: Partial<GraphBody>): Promise<GraphEvent | 'missing'> {
    const answer = await this.send('PATCH', `/me/events/${encodeURIComponent(id)}`, { body, accept: [404] })
    return !gone(answer) && isEvent(answer.data) ? answer.data : 'missing'
  }

  async deleteEvent(id: string): Promise<void> {
    gone(await this.send('DELETE', `/me/events/${encodeURIComponent(id)}`, { accept: [404] }))
  }
}
