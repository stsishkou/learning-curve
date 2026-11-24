// A stand-in for Microsoft's token endpoint and the Graph calls the Outlook sync makes, as a `fetch` for tests. Times
// are kept and returned on the clock the request asks for (`Prefer: outlook.timezone`), which is the plan's; a weekly
// series is expanded into its repeats, with the ones changed or cancelled on their own kept beside it.
type Item = Record<string, unknown>

const API = 'https://graph.microsoft.com/v1.0'
const TOKEN = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const MINSK = 3 * 3_600_000
const DAY = 86_400_000
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const isRecord = (value: unknown): value is Item => typeof value === 'object' && value !== null
const json = (status: number, data: unknown = {}) =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
const failure = (status: number, code: string) => json(status, { error: { code, message: code } })
const wall = (time: unknown) => (isRecord(time) && typeof time.dateTime === 'string' ? time.dateTime.slice(0, 16) : '')
const at = (dateTime: string, zone = 'Belarus Standard Time') => ({
  dateTime: `${dateTime}:00.0000000`,
  timeZone: zone,
})
const ms = (wallTime: string) => Date.parse(`${wallTime}Z`)
const day = (t: number) => new Date(t).toISOString().slice(0, 10)

interface Stored {
  calendar: string
  item: Item
}

export class FakeOutlook {
  version = 0
  /** Calls that change something in the calendar, the app's own */
  writes = 0
  /** Set to make Microsoft refuse the refresh token, as after the person removed the app's access */
  revoked = false
  /** Set to answer every Graph call as for an account without a mailbox */
  noMailbox = false
  /** The refresh token Microsoft takes now; each use hands out the next one */
  refresh = 'refresh-1'
  exchanged: Record<string, string> = {}
  readonly calendars = new Map<string, string>()
  readonly stored = new Map<string, Stored>()
  /** Repeats changed or cancelled on their own, by series id and day */
  readonly exceptions = new Map<string, Map<string, Item | 'cancelled'>>()
  readonly transactions = new Set<string>()

  event(id: string): Item | undefined {
    return this.stored.get(id)?.item
  }

  live(): Item[] {
    return [...this.stored.values()].map((s) => s.item)
  }

  /** An edit made by the person in Outlook. */
  edit(id: string, patch: Item) {
    const stored = this.stored.get(id)
    if (!stored) throw new Error(`No event ${id}`)
    this.put(stored.calendar, { ...stored.item, ...patch })
  }

  /** Deleted by the person in Outlook. */
  remove(id: string) {
    this.stored.delete(id)
  }

  /** One repeat of a series changed by the person in Outlook, or cancelled with `'cancelled'`. */
  repeat(series: string, on: string, patch: Item | 'cancelled') {
    const days = this.exceptions.get(series) ?? new Map<string, Item | 'cancelled'>()
    const before = days.get(on)
    days.set(on, patch === 'cancelled' ? patch : { ...(isRecord(before) ? before : {}), ...patch })
    this.exceptions.set(series, days)
    this.version += 1
  }

  private put(calendar: string, item: Item) {
    this.version += 1
    const id = String(item.id)
    this.stored.set(id, { calendar, item: { ...item, changeKey: `k${this.version}` } })
    return this.stored.get(id)?.item
  }

  readonly fetch = (input: string | URL | Request, init: RequestInit = {}): Promise<Response> =>
    Promise.resolve(this.answer(input, init))

  private answer(input: string | URL | Request, init: RequestInit): Response {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init.method ?? 'GET'
    const body = typeof init.body === 'string' || init.body instanceof URLSearchParams ? String(init.body) : ''
    if (url.href === TOKEN) return this.token(new URLSearchParams(body))
    if (!url.href.startsWith(API)) return json(404)
    if (this.revoked) return failure(401, 'InvalidAuthenticationToken')
    const headers = new Headers(init.headers)
    if (headers.get('authorization') !== 'Bearer access') return failure(401, 'InvalidAuthenticationToken')
    if (this.noMailbox) return failure(404, 'MailboxNotEnabledForRESTAPI')
    if (!headers.get('prefer')?.includes('outlook.timezone="Belarus Standard Time"')) return failure(400, 'NoZone')
    const parsed: unknown = body ? JSON.parse(body) : {}
    const data = isRecord(parsed) ? parsed : {}
    if (method !== 'GET') this.writes += 1
    const [kind = '', id = '', part = ''] = url.pathname.slice('/v1.0/me/'.length).split('/').map(decodeURIComponent)
    if (kind === 'calendars') return this.calendar(method, id, part, data, url.searchParams)
    if (kind === 'events') return this.events(method, id, part, data, url.searchParams)
    return json(404)
  }

  private token(form: URLSearchParams) {
    if (!form.get('scope')?.includes('Calendars.ReadWrite')) return json(400, { error: 'invalid_request' })
    const grant = { access_token: 'access', expires_in: 3599, scope: 'https://graph.microsoft.com/Calendars.ReadWrite' }
    if (form.get('grant_type') === 'authorization_code') {
      this.exchanged = Object.fromEntries(form)
      return json(200, { ...grant, refresh_token: this.refresh })
    }
    if (this.revoked || form.get('refresh_token') !== this.refresh) return json(400, { error: 'invalid_grant' })
    this.refresh = `refresh-${Number(this.refresh.slice(8)) + 1}`
    return json(200, { ...grant, refresh_token: this.refresh })
  }

  private calendar(method: string, id: string, part: string, data: Item, query: URLSearchParams) {
    if (!id) {
      const made = `cal-${this.calendars.size + 1}`
      this.calendars.set(made, String(data.name))
      return json(201, { id: made, name: data.name })
    }
    if (!this.calendars.has(id)) return failure(404, 'ErrorItemNotFound')
    if (part === 'events' && method === 'POST') return this.insert(id, data)
    if (part === 'events')
      return this.page(
        id,
        [...this.stored.values()].filter((s) => s.calendar === id),
        query,
      )
    if (part === 'calendarView') return this.view(id, query)
    if (method === 'DELETE') {
      this.calendars.delete(id)
      for (const [key, stored] of this.stored) if (stored.calendar === id) this.stored.delete(key)
      return json(204)
    }
    this.calendars.set(id, String(data.name))
    return json(200, { id, name: data.name })
  }

  private insert(calendar: string, data: Item) {
    const transaction = String(data.transactionId)
    if (this.transactions.has(transaction)) return failure(409, 'Duplicate')
    this.transactions.add(transaction)
    const id = `AAMk${this.version + 1}=`
    const type = data.recurrence ? 'seriesMaster' : 'singleInstance'
    return json(201, this.put(calendar, { ...data, id, type, isCancelled: false }))
  }

  /** Two items to a page, so the sync has to follow `@odata.nextLink`. */
  private page(calendar: string, all: Stored[], query: URLSearchParams) {
    const from = Number(query.get('$skip') ?? 0)
    const value = all.slice(from, from + 2).map((s) => s.item)
    const next = new URL(`${API}/me/calendars/${calendar}/events`)
    next.searchParams.set('$skip', String(from + 2))
    return json(200, from + 2 < all.length ? { value, '@odata.nextLink': next.href } : { value })
  }

  /** The repeats of `series` from `start` to `end`, the ones cancelled on their own left out. */
  private repeats(series: Item, start: number, end: number): Item[] {
    const recurrence = isRecord(series.recurrence) ? series.recurrence : {}
    const pattern = isRecord(recurrence.pattern) ? recurrence.pattern : {}
    const days = new Set(Array.isArray(pattern.daysOfWeek) ? pattern.daysOfWeek : [])
    const first = wall(series.start)
    const length = ms(wall(series.end)) - ms(first)
    const changed = this.exceptions.get(String(series.id))
    const out: Item[] = []
    for (let d = Math.max(ms(first.slice(0, 10)), Math.floor((start + MINSK) / DAY) * DAY); d < end + MINSK; d += DAY) {
      const original = d + ms(`1970-01-01T${first.slice(11)}`)
      if (!days.has(WEEKDAYS[new Date(d).getUTCDay()]) || original < ms(first)) continue
      const exception = changed?.get(day(d))
      if (exception === 'cancelled') continue
      const startAt = new Date(original).toISOString().slice(0, 16)
      out.push({
        id: `${String(series.id)}_${day(d)}`,
        changeKey: `k${this.version}`,
        subject: series.subject,
        start: at(startAt),
        end: at(new Date(original + length).toISOString().slice(0, 16)),
        isAllDay: false,
        isCancelled: false,
        type: exception ? 'exception' : 'occurrence',
        seriesMasterId: series.id,
        originalStart: new Date(original - MINSK).toISOString(),
        ...exception,
      })
    }
    return out
  }

  private range(query: URLSearchParams) {
    return [Date.parse(query.get('startDateTime') ?? ''), Date.parse(query.get('endDateTime') ?? '')] as const
  }

  private view(calendar: string, query: URLSearchParams) {
    const [start, end] = this.range(query)
    const items = [...this.stored.values()]
      .filter((s) => s.calendar === calendar)
      .flatMap((s) => (s.item.type === 'seriesMaster' ? this.repeats(s.item, start, end) : [s.item]))
    return json(200, { value: items })
  }

  /** A repeat of a series, by its id `<series>_<day>`. */
  private repeatOf(id: string): { series: Item; on: string } | null {
    const cut = id.lastIndexOf('_')
    const series = this.stored.get(id.slice(0, cut))?.item
    return cut > 0 && series ? { series, on: id.slice(cut + 1) } : null
  }

  private events(method: string, id: string, part: string, data: Item, query: URLSearchParams) {
    const stored = this.stored.get(id)
    if (part === 'instances') {
      const [start, end] = this.range(query)
      return stored ? json(200, { value: this.repeats(stored.item, start, end) }) : failure(404, 'ErrorItemNotFound')
    }
    const repeat = stored ? null : this.repeatOf(id)
    if (repeat) {
      if (method === 'DELETE') this.repeat(String(repeat.series.id), repeat.on, 'cancelled')
      else if (method === 'PATCH') this.repeat(String(repeat.series.id), repeat.on, data)
      return method === 'DELETE' ? json(204) : json(200, { id })
    }
    if (!stored) return failure(404, 'ErrorItemNotFound')
    if (method === 'GET') return json(200, stored.item)
    if (method === 'DELETE') {
      this.stored.delete(id)
      this.exceptions.delete(id)
      return json(204)
    }
    return json(200, this.put(stored.calendar, { ...stored.item, ...data }))
  }
}
