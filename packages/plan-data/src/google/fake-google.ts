// A stand-in for Google's token endpoint and the Calendar API calls the sync makes, as a `fetch` for tests. Every
// change bumps one version: it is the etag of what changed and, as `v<n>`, the sync token of a listing.
type Item = Record<string, unknown>

interface Stored {
  calendar: string
  item: Item
  version: number
}

const API = 'https://www.googleapis.com/calendar/v3'
const isRecord = (value: unknown): value is Item => typeof value === 'object' && value !== null

const json = (status: number, data: unknown = {}) =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
const failure = (status: number, reason: string) => json(status, { error: { code: status, errors: [{ reason }] } })

export class FakeGoogle {
  version = 0
  /** Calls that change something in the calendar, the app's own */
  writes = 0
  /** Set to make Google refuse the refresh token, as after the person revoked access */
  revoked = false
  /** Set to make every sync token given so far too old */
  expired = false
  exchanged: Record<string, string> = {}
  readonly calendars = new Map<string, string>()
  readonly stored = new Map<string, Stored>()

  /** The event with `id`, as Google has it now. */
  event(id: string): Item | undefined {
    return this.stored.get(id)?.item
  }

  live(): Item[] {
    return [...this.stored.values()].filter((s) => s.item.status !== 'cancelled').map((s) => s.item)
  }

  /** An edit made by the person in Google. */
  edit(id: string, patch: Item) {
    const stored = this.stored.get(id)
    if (!stored) throw new Error(`No event ${id}`)
    this.put(stored.calendar, { ...stored.item, ...patch })
  }

  /** One repeat of a series changed by the person: Google keeps it as an event of its own. */
  repeat(seriesId: string, original: string, patch: Item) {
    const series = this.stored.get(seriesId)
    if (!series) throw new Error(`No series ${seriesId}`)
    const id = `${seriesId}_${original.replaceAll(/[-:]/g, '')}00Z`
    const existing = this.stored.get(id)?.item ?? {
      id,
      recurringEventId: seriesId,
      originalStartTime: { dateTime: `${original}:00+03:00` },
      summary: series.item.summary,
      status: 'confirmed',
    }
    this.put(series.calendar, { ...existing, ...patch })
    return id
  }

  private put(calendar: string, item: Item) {
    this.version += 1
    const id = String(item.id)
    this.stored.set(id, { calendar, item: { ...item, etag: `"${this.version}"` }, version: this.version })
    return this.stored.get(id)?.item
  }

  readonly fetch = (input: string | URL | Request, init: RequestInit = {}): Promise<Response> =>
    Promise.resolve(this.answer(input, init))

  private answer(input: string | URL | Request, init: RequestInit): Response {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init.method ?? 'GET'
    const body = typeof init.body === 'string' || init.body instanceof URLSearchParams ? String(init.body) : ''
    if (url.href === 'https://oauth2.googleapis.com/token') return this.token(new URLSearchParams(body))
    if (url.href === 'https://oauth2.googleapis.com/revoke') return json(200)
    if (!url.href.startsWith(API)) return json(404)
    if (this.revoked) return failure(401, 'authError')
    const headers = new Headers(init.headers)
    if (headers.get('authorization') !== 'Bearer access') return failure(401, 'authError')
    const parsed: unknown = body ? JSON.parse(body) : {}
    const data = isRecord(parsed) ? parsed : {}
    const [, calendar = '', , id = '', action = ''] = url.pathname
      .slice('/calendar/v3/calendars'.length)
      .split('/')
      .map(decodeURIComponent)
    if (method !== 'GET') this.writes += 1
    if (!calendar) return this.newCalendar(data)
    if (!this.calendars.has(calendar)) return failure(404, 'notFound')
    if (!url.pathname.includes('/events')) return this.calendar(method, calendar, data)
    if (!id) return method === 'POST' ? this.insert(calendar, data) : this.list(calendar, url.searchParams)
    const stored = this.stored.get(id)
    if (!stored || stored.calendar !== calendar) return failure(404, 'notFound')
    if (action === 'move') return this.move(stored, url.searchParams.get('destination') ?? '')
    if (method === 'GET') return json(200, stored.item)
    if (method === 'DELETE') {
      if (stored.item.status === 'cancelled') return failure(410, 'deleted')
      this.put(calendar, { ...stored.item, status: 'cancelled' })
      return json(204)
    }
    const ifMatch = headers.get('if-match')
    if (ifMatch && ifMatch !== stored.item.etag) return failure(412, 'conditionNotMet')
    return json(200, this.put(calendar, method === 'PUT' ? { ...data, id } : { ...stored.item, ...data }))
  }

  private token(form: URLSearchParams) {
    if (form.get('grant_type') === 'authorization_code') {
      this.exchanged = Object.fromEntries(form)
      return json(200, { access_token: 'access', refresh_token: 'refresh', expires_in: 3599 })
    }
    if (this.revoked || form.get('refresh_token') !== 'refresh') return json(400, { error: 'invalid_grant' })
    return json(200, { access_token: 'access', expires_in: 3599 })
  }

  private newCalendar(data: Item) {
    const id = `c${this.calendars.size + 1}@group.calendar.google.com`
    this.calendars.set(id, String(data.summary))
    return json(200, { id, summary: data.summary, timeZone: data.timeZone })
  }

  private calendar(method: string, id: string, data: Item) {
    if (method === 'DELETE') {
      this.calendars.delete(id)
      for (const [key, stored] of this.stored) if (stored.calendar === id) this.stored.delete(key)
      return json(204)
    }
    this.calendars.set(id, String(data.summary))
    return json(200, { id, summary: data.summary })
  }

  private insert(calendar: string, data: Item) {
    const id = String(data.id)
    if (this.stored.has(id)) return failure(409, 'duplicate')
    return json(200, this.put(calendar, { status: 'confirmed', ...data }))
  }

  private move(stored: Stored, destination: string) {
    if (!this.calendars.has(destination)) return failure(404, 'notFound')
    return json(200, this.put(destination, stored.item))
  }

  private list(calendar: string, query: URLSearchParams) {
    const token = query.get('syncToken')
    if (token && this.expired) return failure(410, 'fullSyncRequired')
    const since = token ? Number(token.slice(1)) : 0
    const all = [...this.stored.values()]
      .filter((s) => s.calendar === calendar && s.version > since)
      .filter((s) => token || query.get('showDeleted') === 'true' || s.item.status !== 'cancelled')
      .toSorted((a, b) => a.version - b.version)
    const size = Number(query.get('maxResults') ?? 250)
    const from = Number(query.get('pageToken') ?? 0)
    const items = all.slice(from, from + size).map((s) => s.item)
    return from + size < all.length
      ? json(200, { items, nextPageToken: String(from + size) })
      : json(200, { items, nextSyncToken: `v${this.version}` })
  }
}
