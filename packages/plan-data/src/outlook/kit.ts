// Node-only: Outlook (Microsoft 365 and Outlook.com, through Microsoft Graph) as a calendar app the plan is kept in.
import { addDays, parseLocal, toMinsk, type Plan } from '@lc/plan-domain'
import {
  isGoneRepeat,
  OUTLOOK_SCOPES,
  outlookBody,
  outlookZone,
  readOutlookCalendar,
  remoteOfOutlook,
  repeatWindow,
  type SyncCalendarRow,
  type SyncRow,
  type SyncState,
  type Written,
} from '@lc/plan-domain/sync'

import type { CalendarAdapter, CalendarKit, Saved } from '../calendar-sync/kit'
import { OutlookApiError, OutlookCalendarApi } from './api'

/** A plan day's midnight as a UTC instant, the way Graph takes the ends of a range. */
const utcOf = (day: string) => new Date(parseLocal(day) - toMinsk(0)).toISOString()

class OutlookAdapter implements CalendarAdapter {
  private readonly api: OutlookCalendarApi
  private readonly timeZone: string

  constructor(api: OutlookCalendarApi, timeZone: string) {
    this.api = api
    this.timeZone = timeZone
  }

  insertCalendar(name: string) {
    return this.api.insertCalendar(name)
  }

  renameCalendar(id: string, name: string) {
    return this.api.renameCalendar(id, name)
  }

  deleteCalendar(id: string) {
    return this.api.deleteCalendar(id)
  }

  async readCalendar(row: SyncCalendarRow, plan: Plan, state: SyncState) {
    const events = await this.api.listEvents(row.id)
    if (events === 'missing') return 'missing'
    const { from, to } = repeatWindow(Date.now())
    // Only a series has repeats to read.
    const repeats = events.some((e) => e.type === 'seriesMaster')
      ? await this.api.calendarView(row.id, utcOf(from), utcOf(to))
      : []
    if (repeats === 'missing') return 'missing'
    return { events: readOutlookCalendar({ events, repeats, from, to }, row.id, plan, state) }
  }

  async getEvent(uid: string, row: SyncRow) {
    const item = await this.api.getEvent(row.id)
    return item && remoteOfOutlook(item, () => uid)
  }

  async insertEvent(calendar: string, _uid: string, written: Written): Promise<Saved> {
    const event = await this.api.insertEvent(calendar, outlookBody(written, this.timeZone))
    const skip = written.repeat?.skip ?? []
    if (!skip.length) return { id: event.id, etag: event.changeKey ?? '' }
    // Graph has no skipped days in a pattern: each is cancelled on its own, which changes the series again.
    await Promise.all(skip.map((day) => this.cancelDay(event.id, day)))
    const series = await this.api.getEvent(event.id)
    return { id: event.id, etag: series?.changeKey ?? event.changeKey ?? '' }
  }

  private async cancelDay(series: string, day: string) {
    const repeats = await this.api.instances(series, utcOf(day), utcOf(addDays(day, 1)))
    await Promise.all(repeats.map((repeat) => this.api.deleteEvent(repeat.id)))
  }

  /** Graph takes no version with a change, so the event is read first: one changed meanwhile is a conflict. */
  async patchEvent(uid: string, row: SyncRow, written: Written) {
    const now = await this.api.getEvent(row.id)
    if (!now) return 'missing'
    if ((now.changeKey ?? '') !== row.etag) return 'conflict'
    // A new pattern would bring cancelled repeats back, and one cannot be brought back on its own: a series that
    // changed is written anew.
    if (written.repeat || now.type === 'seriesMaster') {
      await this.api.deleteEvent(row.id)
      return this.insertEvent(row.calendar, uid, written)
    }
    const patched = await this.api.patchEvent(row.id, outlookBody(written, this.timeZone))
    return patched === 'missing' ? patched : { id: row.id, etag: patched.changeKey ?? '' }
  }

  /** Graph cannot move an event to another calendar: it is written there and deleted here. */
  async moveEvent(uid: string, row: SyncRow, to: string, written: Written) {
    const saved = await this.insertEvent(to, uid, written)
    await this.api.deleteEvent(row.id)
    return saved
  }

  async deleteEvent(_calendar: string, id: string) {
    // A repeat that is gone from Outlook has nothing left to delete.
    if (!isGoneRepeat(id)) await this.api.deleteEvent(id)
  }

  async restoreRepeat(row: SyncRow, source: string, slot: { start: string; end: string }) {
    if (isGoneRepeat(source)) {
      await this.api.deleteEvent(row.id)
      return 'gone' as const
    }
    const zone = outlookZone(this.timeZone)
    await this.api.patchEvent(source, {
      start: { dateTime: `${slot.start}:00`, timeZone: zone },
      end: { dateTime: `${slot.end}:00`, timeZone: zone },
    })
    return 'done' as const
  }
}

/** Errors that mean the account has no Exchange Online mailbox Graph can reach. */
const NO_MAILBOX = new Set(['MailboxNotEnabledForRESTAPI', 'MailboxNotSupportedForRESTAPI', 'ResourceNotFound'])

export const outlook: CalendarKit = {
  provider: 'outlook',
  auth: {
    authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: OUTLOOK_SCOPES.join(' '),
    // The person picks the account: a work and a personal one are often both signed in.
    page: { response_mode: 'query', prompt: 'select_account' },
    scopeOnToken: true,
    granted: (scope) => /calendars\.readwrite/i.test(decodeURIComponent(scope)),
    env: { id: 'OUTLOOK_CLIENT_ID', secret: 'OUTLOOK_CLIENT_SECRET' },
  },
  adapter: (token, timeZone) => new OutlookAdapter(new OutlookCalendarApi(token, outlookZone(timeZone)), timeZone),
  problemOf(err) {
    if (!(err instanceof OutlookApiError)) return null
    if (err.code === 'ErrorAccessDenied' || err.status === 403) return 'scope'
    if (NO_MAILBOX.has(err.code)) return 'mailbox'
    return null
  },
}
