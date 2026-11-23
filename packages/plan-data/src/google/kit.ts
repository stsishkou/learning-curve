// Node-only: Google Calendar as a calendar app the plan is kept in.
import {
  GOOGLE_SCOPE,
  googleBody,
  googleEventId,
  googleTime,
  remoteOfGoogle,
  type SyncCalendarRow,
  type SyncRow,
  type Written,
} from '@lc/plan-domain'

import type { CalendarAdapter, CalendarKit, Saved } from '../calendar-sync/kit'
import { GoogleApiError, GoogleCalendarApi } from './api'

class GoogleAdapter implements CalendarAdapter {
  private readonly api: GoogleCalendarApi
  private readonly timeZone: string

  constructor(api: GoogleCalendarApi, timeZone: string) {
    this.api = api
    this.timeZone = timeZone
  }

  insertCalendar(name: string) {
    return this.api.insertCalendar(name, this.timeZone)
  }

  renameCalendar(id: string, name: string) {
    return this.api.patchCalendar(id, name)
  }

  deleteCalendar(id: string) {
    return this.api.deleteCalendar(id)
  }

  async readCalendar(row: SyncCalendarRow) {
    let listing = await this.api.listEvents(row.id, row.cursor)
    if (listing === 'gone') listing = await this.api.listEvents(row.id)
    // Deleted in Google, or in another account than the one connected now.
    if (typeof listing === 'string') return 'missing'
    return {
      events: listing.items.flatMap((item) => remoteOfGoogle(item) ?? []),
      cursor: listing.syncToken || undefined,
    }
  }

  async getEvent(_uid: string, row: SyncRow) {
    const item = await this.api.getEvent(row.calendar, row.id)
    return item && remoteOfGoogle(item)
  }

  async insertEvent(calendar: string, uid: string, written: Written): Promise<Saved> {
    const body = googleBody(uid, written, this.timeZone)
    const event = await this.api.insertEvent(calendar, body)
    return { id: body.id, etag: event.etag ?? '' }
  }

  async patchEvent(uid: string, row: SyncRow, written: Written) {
    const patched = await this.api.patchEvent(row.calendar, row.id, googleBody(uid, written, this.timeZone), row.etag)
    return typeof patched === 'string' ? patched : { id: row.id, etag: patched.etag ?? '' }
  }

  async moveEvent(_uid: string, row: SyncRow, to: string) {
    const moved = await this.api.moveEvent(row.calendar, row.id, to)
    return moved === 'missing' ? moved : { id: row.id, etag: moved.etag ?? '' }
  }

  deleteEvent(calendar: string, id: string) {
    return this.api.deleteEvent(calendar, id)
  }

  async restoreRepeat(row: SyncRow, source: string, slot: { start: string; end: string }) {
    await this.api.patchEvent(row.calendar, source, {
      status: 'confirmed',
      start: googleTime(slot.start, this.timeZone),
      end: googleTime(slot.end, this.timeZone),
    })
    return 'done' as const
  }
}

export const google: CalendarKit = {
  provider: 'google',
  auth: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    revoke: 'https://oauth2.googleapis.com/revoke',
    scope: GOOGLE_SCOPE,
    // Asking for consent every time makes Google hand out a refresh token every time.
    page: { access_type: 'offline', prompt: 'consent' },
    scopeOnToken: false,
    granted: (scope) => scope.split(' ').includes(GOOGLE_SCOPE),
    env: { id: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET' },
  },
  adapter: (token, timeZone) => new GoogleAdapter(new GoogleCalendarApi(token), timeZone),
  problemOf(err) {
    if (!(err instanceof GoogleApiError)) return null
    if (err.reason === 'accessNotConfigured' || err.reason === 'SERVICE_DISABLED') return 'api-off'
    if (err.reason === 'insufficientPermissions' || err.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT') return 'scope'
    return null
  },
  idOf: googleEventId,
}
