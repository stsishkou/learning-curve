// Node-only: Google Calendar as a calendar app the plan is kept in, behind the `CalendarConnector` port.
import { GOOGLE_SCOPE, googleBody, googleEventId, googleTime, remoteOfGoogle } from '@lc/plan-domain/sync'
import type { CalendarAdapter, CalendarConnector } from '@lc/plan-service'

import { GoogleApiError, GoogleCalendarApi } from './api'

function googleAdapter(api: GoogleCalendarApi, timeZone: string): CalendarAdapter {
  return {
    insertCalendar: (name) => api.insertCalendar(name, timeZone),
    renameCalendar: (id, name) => api.patchCalendar(id, name),
    deleteCalendar: (id) => api.deleteCalendar(id),
    readCalendar: async (row) => {
      let listing = await api.listEvents(row.id, row.cursor)
      if (listing === 'gone') listing = await api.listEvents(row.id)
      // Deleted in Google, or in another account than the one connected now.
      if (typeof listing === 'string') return 'missing'
      return {
        events: listing.items.flatMap((item) => remoteOfGoogle(item) ?? []),
        cursor: listing.syncToken || undefined,
      }
    },
    getEvent: async (_uid, row) => {
      const item = await api.getEvent(row.calendar, row.id)
      return item && remoteOfGoogle(item)
    },
    insertEvent: async (calendar, uid, written) => {
      const body = googleBody(uid, written, timeZone)
      const event = await api.insertEvent(calendar, body)
      return { id: body.id, etag: event.etag ?? '' }
    },
    patchEvent: async (uid, row, written) => {
      const patched = await api.patchEvent(row.calendar, row.id, googleBody(uid, written, timeZone), row.etag)
      return typeof patched === 'string' ? patched : { id: row.id, etag: patched.etag ?? '' }
    },
    moveEvent: async (_uid, row, to) => {
      const moved = await api.moveEvent(row.calendar, row.id, to)
      return moved === 'missing' ? moved : { id: row.id, etag: moved.etag ?? '' }
    },
    deleteEvent: (calendar, id) => api.deleteEvent(calendar, id),
    restoreRepeat: async (row, source, slot) => {
      await api.patchEvent(row.calendar, source, {
        status: 'confirmed',
        start: googleTime(slot.start, timeZone),
        end: googleTime(slot.end, timeZone),
      })
      return 'done'
    },
  }
}

/**
 * Google Calendar through its REST API, signed in with the person's own OAuth client and the narrow scope that
 * reaches only the calendars the app made. Event ids follow from the plan's uids.
 */
export const googleConnector: CalendarConnector = {
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
  },
  adapter: (token, timeZone) => googleAdapter(new GoogleCalendarApi(token), timeZone),
  problemOf: (err) => {
    if (!(err instanceof GoogleApiError)) return null
    if (err.reason === 'accessNotConfigured' || err.reason === 'SERVICE_DISABLED') return 'api-off'
    if (err.reason === 'insufficientPermissions' || err.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT') return 'scope'
    return null
  },
  idOf: googleEventId,
}
