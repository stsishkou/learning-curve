import { fmtDay, fmtHours, fmtMonth } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, HOUR, parseLocal, startOfMonth, type Plan } from '@lc/plan-domain'
import { calendarColor, Dot, INPUT } from '@lc/ui'
import { useState } from 'react'

/** Every event of the document as a list that can be searched and narrowed to one calendar. */
export function ReaderEvents({ plan }: { plan: Plan }) {
  const [query, setQuery] = useState('')
  const [calendar, setCalendar] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = plan.events
    .filter((e) => !calendar || e.calendar === calendar)
    .filter((e) => !needle || `${e.title}\n${e.description}`.toLowerCase().includes(needle))
    .toSorted((a, b) => a.start.localeCompare(b.start))
  const calendarOf = (id: string) => plan.calendars.find((c) => c.id === id)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          className={`${INPUT} min-w-0 flex-1`}
          aria-label={m.reader_search_events()}
          placeholder={m.reader_search_events()}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={`${INPUT} max-w-[45%]`}
          aria-label={m.field_calendar()}
          value={calendar}
          onChange={(e) => setCalendar(e.target.value)}
        >
          <option value="">{m.reader_all_calendars()}</option>
          {plan.calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-[12.5px] text-muted tabular-nums">
          {m.reader_shown({ shown: shown.length, total: plan.events.length })}
        </span>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-line-soft">
        {!shown.length && <p className="px-4 py-10 text-center text-[14px] text-muted">{m.reader_no_events()}</p>}
        {shown.map((e, i) => {
          const s = parseLocal(e.start)
          const end = parseLocal(e.end)
          const before = shown[i - 1]
          const previous = before ? startOfMonth(parseLocal(before.start)) : null
          const heading = previous === startOfMonth(s) ? null : fmtMonth(startOfMonth(s))
          const cal = calendarOf(e.calendar)
          return (
            <div key={e.uid}>
              {heading && (
                <h4 className="sticky top-0 z-1 border-b border-line-soft bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold text-muted">
                  {heading}
                </h4>
              )}
              <details className="group border-b border-line-soft last:border-b-0" style={calendarColor(cal?.color)}>
                <summary className="grid cursor-pointer grid-cols-[92px_1fr_auto] items-baseline gap-x-3 px-3 py-2 text-[13.5px] hover:bg-surface-2 md:grid-cols-[92px_96px_1fr_150px_52px]">
                  <span className="text-muted tabular-nums">{fmtDay(s)}</span>
                  <span className="hidden text-muted tabular-nums md:block">
                    {e.allDay ? m.all_day() : `${hm(s)}–${hm(end)}`}
                    {e.rrule ? ' ↻' : ''}
                  </span>
                  <span className={`min-w-0 truncate group-open:whitespace-normal ${e.done ? 'line-through' : ''}`}>
                    <Dot className="mr-2 inline-block size-2 -translate-y-px" />
                    {e.title}
                  </span>
                  <span className="hidden truncate text-[12.5px] text-muted md:block">{cal?.name}</span>
                  <span className="text-right text-[12.5px] text-muted tabular-nums">
                    {e.allDay || e.rrule ? '' : fmtHours((end - s) / HOUR)}
                  </span>
                </summary>
                <div className="px-3 pb-3 text-[13px]">
                  <p className="text-muted tabular-nums md:hidden">
                    {e.allDay ? m.all_day() : `${hm(s)}–${hm(end)}`} · {cal?.name}
                  </p>
                  {e.description && (
                    <pre className="mt-1.5 rounded-[10px] bg-surface-2 px-3 py-2.5 font-sans text-[13px]/[1.55] wrap-anywhere whitespace-pre-wrap">
                      {e.description}
                    </pre>
                  )}
                  <code className="mt-1.5 block text-[11.5px] wrap-anywhere text-muted">{e.uid}</code>
                </div>
              </details>
            </div>
          )
        })}
      </div>
    </div>
  )
}
