import { dowShort, fmtDay, fmtHours, fmtMonthName } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  countsToBudget,
  DAY,
  durationHours,
  mondayOf,
  startOfDay,
  startOfMonth,
  ymd,
  type Occurrence,
  type Plan,
} from '@lc/plan-domain'
import { useRef } from 'react'

import { useFillHeight } from '../../../shared/lib'

interface Props {
  plan: Plan
  year: number
  /** The occurrences of that year, with the hidden calendars already left out */
  items: Occurrence[]
  /** Minsk wall-clock ms; null before the clock is known, as on the server */
  now: number | null
  /** Called with the day that was clicked, wall-clock ms: the page opens its week */
  onPickDay: (day: number) => void
  /** Called with the first day of the month whose name was clicked */
  onPickMonth: (month: number) => void
}

/** Study hours of a day from which each deeper shade starts */
const STEPS = [0, 1, 2]
// One hue, light to dark: the more hours, the deeper. The text stays ink on every step.
const SHADE = [
  '',
  'bg-[color-mix(in_srgb,var(--focus)_14%,var(--surface))]',
  'bg-[color-mix(in_srgb,var(--focus)_27%,var(--surface))]',
  'bg-[color-mix(in_srgb,var(--focus)_42%,var(--surface))]',
]
const shadeOf = (hours: number) => SHADE[STEPS.filter((from) => hours > from).length]

/**
 * The twelve months of a year on one screen. A day is shaded by its study hours, so the heavy and the empty
 * stretches of the plan show at a glance; a dot marks a day with an all-day event, such as a deadline.
 */
export function YearGrid({ plan, year, items, now, onPickDay, onPickMonth }: Props) {
  const hours = new Map<number, number>()
  const marked = new Set<number>()
  for (const o of items) {
    const day = startOfDay(o.s)
    if (o.allDay) marked.add(day)
    else if (countsToBudget(o)) hours.set(day, (hours.get(day) ?? 0) + durationHours(o))
  }
  const today = now === null ? null : startOfDay(now)
  const months = Array.from({ length: 12 }, (_, i) => Date.UTC(year, i, 1))
  const weekdays = Array.from({ length: 7 }, (_, i) => mondayOf(Date.UTC(year, 0, 1)) + i * DAY)
  // Like the other views, the year ends where the window does and scrolls inside itself.
  const box = useRef<HTMLDivElement>(null)
  const maxHeight = useFillHeight(box, true, { minWidth: 961 })

  return (
    <div ref={box} className="overflow-y-auto rounded-2xl p-4" style={{ maxHeight }}>
      <div className="sm:grid-cols-2 xl:grid-cols-4 grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-3">
        {months.map((month) => {
          const first = mondayOf(month)
          const weeks = Math.ceil((startOfMonth(month, 1) - first) / (7 * DAY))
          return (
            <section key={month} className="min-w-0">
              <h3 className="mb-1.5">
                <button
                  type="button"
                  className="-ml-1.5 rounded-md px-1.5 py-0.5 text-[13.5px] font-semibold hover:bg-surface-2"
                  onClick={() => onPickMonth(month)}
                >
                  {fmtMonthName(month)}
                </button>
              </h3>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[11.5px] tabular-nums">
                {weekdays.map((d) => (
                  <span key={d} aria-hidden className="pb-0.5 text-[10.5px] text-muted">
                    {dowShort(d).slice(0, 2)}
                  </span>
                ))}
                {Array.from({ length: weeks * 7 }, (_, i) => first + i * DAY).map((d) => {
                  // A day of the neighbouring month keeps its cell empty, so the weeks stay aligned.
                  if (startOfMonth(d) !== month) return <span key={d} />
                  const studied = hours.get(d) ?? 0
                  const off = plan.meta.holidays.includes(ymd(d))
                  return (
                    <button
                      key={d}
                      type="button"
                      data-day={ymd(d)}
                      className={`relative grid h-7 place-items-center rounded-md hover:ring-2 hover:ring-line ${shadeOf(studied)} ${d === today ? 'font-bold text-today-ink ring-2 ring-today' : off ? 'text-muted' : ''}`}
                      aria-label={studied ? `${fmtDay(d)}: ${fmtHours(studied)}` : fmtDay(d)}
                      data-tip={studied ? `${fmtDay(d)}: ${fmtHours(studied)}` : fmtDay(d)}
                      onClick={() => onPickDay(d)}
                    >
                      {new Date(d).getUTCDate()}
                      {marked.has(d) && (
                        <i aria-hidden className="absolute bottom-[3px] size-1 rounded-full bg-today" />
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      <p className="mt-4 flex items-center justify-end gap-1.5 text-[12px] text-muted">
        {m.year_less()}
        {SHADE.map((shade) => (
          <i key={shade} aria-hidden className={`size-3.5 rounded-sm border border-line-soft ${shade}`} />
        ))}
        {m.year_more()}
        <span className="ml-1">· {m.study_that_day()}</span>
      </p>
    </div>
  )
}
