// Node-only: Outlook (Microsoft 365 and Outlook.com, through Microsoft Graph) as a calendar app the plan is kept in,
// behind the `CalendarConnector` port.
import { addDays, parseLocal, toMinsk } from '@lc/plan-domain'
import {
  isGoneRepeat,
  OUTLOOK_SCOPES,
  outlookBody,
  outlookZone,
  readOutlookCalendar,
  remoteOfOutlook,
  repeatWindow,
  type Written,
} from '@lc/plan-domain/sync'
import type { CalendarAdapter, CalendarConnector, Saved } from '@lc/plan-service'

import { OutlookApiError, OutlookCalendarApi } from './api'

/** A plan day's midnight as a UTC instant, the way Graph takes the ends of a range. */
const utcOf = (day: string) => new Date(parseLocal(day) - toMinsk(0)).toISOString()

function outlookAdapter(api: OutlookCalendarApi, timeZone: string): CalendarAdapter {
  const cancelDay = async (series: string, day: string) => {
    const repeats = await api.instances(series, utcOf(day), utcOf(addDays(day, 1)))
    await Promise.all(repeats.map((repeat) => api.deleteEvent(repeat.id)))
  }

  const insertEvent = async (calendar: string, written: Written): Promise<Saved> => {
    const event = await api.insertEvent(calendar, outlookBody(written, timeZone))
    const skip = written.repeat?.skip ?? []
    if (!skip.length) return { id: event.id, etag: event.changeKey ?? '' }
    // Graph has no skipped days in a pattern: each is cancelled on its own, which changes the series again.
    await Promise.all(skip.map((day) => cancelDay(event.id, day)))
    const series = await api.getEvent(event.id)
    return { id: event.id, etag: series?.changeKey ?? event.changeKey ?? '' }
  }

  return {
    insertCalendar: (name) => api.insertCalendar(name),
    renameCalendar: (id, name) => api.renameCalendar(id, name),
    deleteCalendar: (id) => api.deleteCalendar(id),
    readCalendar: async (row, plan, state) => {
      const events = await api.listEvents(row.id)
      if (events === 'missing') return 'missing'
      const { from, to } = repeatWindow(Date.now())
      // Only a series has repeats to read.
      const repeats = events.some((e) => e.type === 'seriesMaster')
        ? await api.calendarView(row.id, utcOf(from), utcOf(to))
        : []
      if (repeats === 'missing') return 'missing'
      return { events: readOutlookCalendar({ events, repeats, from, to }, row.id, plan, state) }
    },
    getEvent: async (uid, row) => {
      const item = await api.getEvent(row.id)
      return item && remoteOfOutlook(item, () => uid)
    },
    insertEvent: (calendar, _uid, written) => insertEvent(calendar, written),
    // Graph takes no version with a change, so the event is read first: one changed meanwhile is a conflict.
    patchEvent: async (_uid, row, written) => {
      const now = await api.getEvent(row.id)
      if (!now) return 'missing'
      if ((now.changeKey ?? '') !== row.etag) return 'conflict'
      // A new pattern would bring cancelled repeats back, and one cannot be brought back on its own: a series that
      // changed is written anew.
      if (written.repeat || now.type === 'seriesMaster') {
        await api.deleteEvent(row.id)
        return insertEvent(row.calendar, written)
      }
      const patched = await api.patchEvent(row.id, outlookBody(written, timeZone))
      return patched === 'missing' ? patched : { id: row.id, etag: patched.changeKey ?? '' }
    },
    // Graph cannot move an event to another calendar: it is written there and deleted here.
    moveEvent: async (_uid, row, to, written) => {
      const saved = await insertEvent(to, written)
      await api.deleteEvent(row.id)
      return saved
    },
    deleteEvent: async (_calendar, id) => {
      // A repeat that is gone from Outlook has nothing left to delete.
      if (!isGoneRepeat(id)) await api.deleteEvent(id)
    },
    restoreRepeat: async (row, source, slot) => {
      if (isGoneRepeat(source)) {
        await api.deleteEvent(row.id)
        return 'gone'
      }
      const zone = outlookZone(timeZone)
      await api.patchEvent(source, {
        start: { dateTime: `${slot.start}:00`, timeZone: zone },
        end: { dateTime: `${slot.end}:00`, timeZone: zone },
      })
      return 'done'
    },
  }
}

/** Errors that mean the account has no Exchange Online mailbox Graph can reach. */
const NO_MAILBOX = new Set(['MailboxNotEnabledForRESTAPI', 'MailboxNotSupportedForRESTAPI', 'ResourceNotFound'])

/**
 * Outlook through Microsoft Graph, for a work or a personal Microsoft account, signed in with the person's own OAuth
 * client. Graph gives event ids of its own, kept in the sync state.
 */
export const outlookConnector: CalendarConnector = {
  provider: 'outlook',
  auth: {
    authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: OUTLOOK_SCOPES.join(' '),
    // The person picks the account: a work and a personal one are often both signed in.
    page: { response_mode: 'query', prompt: 'select_account' },
    scopeOnToken: true,
    granted: (scope) => /calendars\.readwrite/i.test(decodeURIComponent(scope)),
  },
  adapter: (token, timeZone) => outlookAdapter(new OutlookCalendarApi(token, outlookZone(timeZone)), timeZone),
  problemOf: (err) => {
    if (!(err instanceof OutlookApiError)) return null
    if (err.code === 'ErrorAccessDenied' || err.status === 403) return 'scope'
    if (NO_MAILBOX.has(err.code)) return 'mailbox'
    return null
  },
}
