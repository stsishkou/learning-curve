import { dowShort, fmtDay, fmtMonth } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, isoWeek, mondayOf, occurrences, startOfDay, startOfMonth, type Plan } from '@lc/plan-domain'
import { ChevronLeft, ChevronRight } from '@lc/ui'
import { useState } from 'react'

interface Props {
  plan: Plan
  /** Ids of the calendars filtered out */
  hidden: ReadonlySet<string>
  /** Minsk wall-clock ms; null before the clock is known, as on the server */
  now: number | null
  /** The days the calendar shows now: they are marked. `start` is wall-clock ms */
  shown: { start: number; days: number }
  /** Called with the day that was clicked, wall-clock ms */
  onPickDay: (day: number) => void
  /** Called with the Monday of the week whose number was clicked */
  onPickWeek: (monday: number) => void
}

const ARROW = 'grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink'

/**
 * A month to jump around the plan with: a click on a day or on a week number shows it in the calendar. A dot
 * marks a day that has events. The arrows page through the months without moving the calendar.
 */
export function MiniMonth({ plan, hidden, now, shown, onPickDay, onPickWeek }: Props) {
  // Months paged away from the one the calendar shows; the page gives the widget a new key when that one changes.
  const [paged, setPaged] = useState(0)
  const month = startOfMonth(shown.start + Math.min(shown.days - 1, 3) * DAY, paged)
  const first = mondayOf(month)
  const weeks = Math.ceil((startOfMonth(month, 1) - first) / (7 * DAY))
  const busy = new Set(occurrences(plan, first, first + weeks * 7 * DAY, hidden).map((o) => startOfDay(o.s)))
  const today = now === null ? null : startOfDay(now)

  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        <b className="mr-auto text-[13.5px] font-semibold">{fmtMonth(month)}</b>
        <button type="button" className={ARROW} aria-label={m.previous_period()} onClick={() => setPaged(paged - 1)}>
          <ChevronLeft size={16} aria-hidden />
        </button>
        <button type="button" className={ARROW} aria-label={m.next_period()} onClick={() => setPaged(paged + 1)}>
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-y-0.5 text-center text-[12px] tabular-nums">
        <span className="pr-1.5 text-[10.5px] text-muted" data-tip={m.week_number()}>
          {m.week_short()}
        </span>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} aria-hidden className="text-[10.5px] text-muted">
            {dowShort(first + i * DAY).slice(0, 2)}
          </span>
        ))}
        {Array.from({ length: weeks }, (_, w) => first + w * 7 * DAY).map((monday) => (
          <div key={monday} className="col-span-full grid grid-cols-subgrid">
            <button
              type="button"
              className="rounded-md pr-1.5 text-[10.5px] text-muted hover:text-ink"
              aria-label={m.week_of_year({ number: isoWeek(monday) })}
              onClick={() => onPickWeek(monday)}
            >
              {isoWeek(monday)}
            </button>
            {Array.from({ length: 7 }, (_, i) => monday + i * DAY).map((d) => {
              const marked = d >= shown.start && d < shown.start + shown.days * DAY
              return (
                <button
                  key={d}
                  type="button"
                  className={`relative grid h-7 place-items-center hover:bg-surface-2 ${marked ? 'bg-surface-2' : 'rounded-md'} ${marked && d === shown.start ? 'rounded-l-md' : ''} ${marked && d === shown.start + (shown.days - 1) * DAY ? 'rounded-r-md' : ''} ${d === today ? 'font-bold text-today-ink' : startOfMonth(d) === month ? '' : 'text-muted'}`}
                  aria-label={fmtDay(d)}
                  aria-current={d === today ? 'date' : undefined}
                  onClick={() => onPickDay(d)}
                >
                  {new Date(d).getUTCDate()}
                  {busy.has(d) && <i aria-hidden className="absolute bottom-[2px] size-1 rounded-full bg-focus" />}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
