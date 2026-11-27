import { expect, test } from 'vitest'

import { addDays } from '../core/dates'
import { isSession } from '../core/progress'
import { weekdaysOf } from '../core/recurrence'
import { fixturePlan, itemAt } from '../fixtures'
import { rowOf, writtenOf, type SyncState } from './calendar-sync'
import {
  goneRepeatId,
  outlookBody,
  outlookRecurrence,
  outlookWall,
  readOutlookCalendar,
  remoteOfOutlook,
  type GraphEvent,
} from './outlook-sync'

const TZ = fixturePlan.meta.timezone
const session = itemAt(fixturePlan.events.filter((e) => isSession(e) && !e.done && e.calendar !== 'personal'))
const repeat = itemAt(fixturePlan.events.filter((e) => e.rrule))

test('a plan event goes to Outlook on the plan clock, a done one as free time, a repeat as a weekly pattern', () => {
  const body = outlookBody(writtenOf({ ...session, done: true }), TZ)
  expect(body).toMatchObject({
    subject: `✓ ${session.title}`,
    showAs: 'free',
    isAllDay: false,
    start: { dateTime: `${session.start}:00`, timeZone: 'Belarus Standard Time' },
    recurrence: null,
  })
  const day = '2026-12-01'
  expect(outlookBody({ ...writtenOf(session), allDay: true, start: day, end: '2026-12-02' }, TZ)).toMatchObject({
    isAllDay: true,
    start: { dateTime: `${day}T00:00:00` },
    end: { dateTime: '2026-12-02T00:00:00' },
  })
  expect(outlookRecurrence('FREQ=WEEKLY;BYDAY=TU,TH', '2026-11-24')).toEqual({
    pattern: { type: 'weekly', interval: 1, daysOfWeek: ['tuesday', 'thursday'], firstDayOfWeek: 'monday' },
    range: { type: 'noEnd', startDate: '2026-11-24' },
  })
  expect(outlookRecurrence('FREQ=WEEKLY;INTERVAL=2;UNTIL=20270131T000000Z', '2026-11-24')).toMatchObject({
    pattern: { interval: 2, daysOfWeek: ['tuesday'] },
    range: { type: 'endDate', endDate: '2027-01-31' },
  })
})

test('times come back on the plan clock, whether Graph used the zone asked for or UTC', () => {
  expect(outlookWall({ dateTime: '2026-12-01T18:30:00.0000000', timeZone: 'Belarus Standard Time' }, false)).toBe(
    '2026-12-01T18:30',
  )
  expect(outlookWall({ dateTime: '2026-12-01T15:30:00.0000000', timeZone: 'UTC' }, false)).toBe('2026-12-01T18:30')
  expect(outlookWall({ dateTime: '2026-12-01T00:00:00.0000000', timeZone: 'Belarus Standard Time' }, true)).toBe(
    '2026-12-01',
  )
  const repeatOf: GraphEvent = {
    id: 'r',
    seriesMasterId: 'm',
    originalStart: '2026-12-08T05:30:00Z',
    type: 'exception',
  }
  expect(remoteOfOutlook(repeatOf, (id) => (id === 'm' ? repeat.uid : null))).toMatchObject({
    uid: repeat.uid,
    day: '2026-12-08',
  })
})

/** The session and the repeat written to one Outlook calendar. */
function written(): SyncState {
  return {
    calendars: {},
    events: {
      [session.uid]: rowOf(writtenOf(session), 'cal', 'single', 'k1'),
      [repeat.uid]: rowOf(writtenOf(repeat), 'cal', 'series', 'k2'),
    },
  }
}
const asRead = (id: string, start: string, end: string, changeKey: string): GraphEvent => ({
  id,
  changeKey,
  subject: id === 'single' ? session.title : repeat.title,
  start: { dateTime: `${start}:00.0000000`, timeZone: 'Belarus Standard Time' },
  end: { dateTime: `${end}:00.0000000`, timeZone: 'Belarus Standard Time' },
})

/** The repeats of the series in the first `weeks` weeks, as calendarView lists them. */
function repeatsOf(weeks: number): GraphEvent[] {
  const days = new Set(weekdaysOf(repeat.rrule ?? ''))
  const out: GraphEvent[] = []
  for (let n = 0; n < weeks * 7; n += 1) {
    const day = addDays(repeat.start.slice(0, 10), n)
    if (!days.has(new Date(`${day}T00:00Z`).getUTCDay()) || repeat.skip?.includes(day)) continue
    const at = repeat.start.slice(11, 16)
    out.push({
      ...asRead(`${day}-repeat`, `${day}T${at}`, `${day}T${repeat.end.slice(11, 16)}`, 'k'),
      type: 'occurrence',
      seriesMasterId: 'series',
      originalStart: new Date(Date.parse(`${day}T${at}:00+03:00`)).toISOString(),
    })
  }
  return out
}

test('a full read finds what was deleted in Outlook: a whole event, or one repeat of a series', () => {
  const state = written()
  const from = repeat.start.slice(0, 10)
  const to = addDays(from, 14)
  const events = [asRead('single', session.start, session.end, 'k1'), asRead('series', repeat.start, repeat.end, 'k2')]
  const repeats = repeatsOf(2)
  const read = (part: Partial<{ events: GraphEvent[]; repeats: GraphEvent[] }>) =>
    readOutlookCalendar({ events, repeats, from, to, ...part }, 'cal', fixturePlan, state)

  expect(read({}).filter((item) => item.cancelled)).toEqual([])
  expect(read({ events: events.slice(1) }).filter((item) => item.cancelled)).toEqual([
    { id: 'single', uid: session.uid, etag: '', cancelled: true, summary: '', start: null, end: null },
  ])

  const [first, ...rest] = repeats
  const day = first?.originalStart?.slice(0, 10) ?? ''
  expect(read({ repeats: rest }).filter((item) => item.cancelled)).toMatchObject([
    { id: goneRepeatId('series', day), uid: repeat.uid, day },
  ])
  // A series none of whose repeats were read is not taken as cancelled day by day.
  expect(read({ repeats: [] }).filter((item) => item.cancelled)).toEqual([])
  // Nor is one the planner changed since: its new version is about to replace it.
  const moved = {
    ...state,
    events: { ...state.events, [repeat.uid]: { ...rowOf(writtenOf(repeat), 'cal', 'series', 'k2'), hash: 'old' } },
  }
  expect(
    readOutlookCalendar({ events, repeats: rest, from, to }, 'cal', fixturePlan, moved).filter((i) => i.day),
  ).toEqual([])
})
