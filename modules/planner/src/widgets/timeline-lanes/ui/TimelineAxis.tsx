import { fmtMonthName, fmtMonthShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, ymd } from '@lc/plan-domain'
import type { Ref } from 'react'

import type { Scale, Ticks } from '../lib/scale'

interface Props {
  scale: Scale
  ticks: Ticks
  now: number | null
  /** Width of a day on screen; 0 before it is measured */
  pxPerDay: number
  ref?: Ref<HTMLDivElement> | undefined
}

// A month whose name would not fit is named short; Monday numbers closer than this are thinned out.
const LONG_MONTH_PX = 80
const MONDAY_PX = 26
// The first month is named at the left edge unless the next one starts this close to it.
const EDGE_DAYS = 10

/** Months and Mondays over the lanes, and where today is. */
export function TimelineAxis({ scale, ticks, now, pxPerDay, ref }: Props) {
  const monthName = pxPerDay * 30 >= LONG_MONTH_PX ? fmtMonthName : fmtMonthShort
  const step = [1, 2, 4].find((k) => pxPerDay * 7 * k >= MONDAY_PX)
  const [next] = ticks.months
  const months =
    next !== undefined && next - scale.start < EDGE_DAYS * DAY ? ticks.months : [scale.start, ...ticks.months]
  const todayAt = now === null ? null : scale.at(now)
  return (
    <div ref={ref} aria-hidden className="relative h-12 overflow-hidden border-b border-line text-[11.5px] text-muted">
      {ticks.months.map((t) => (
        <i key={t} className="absolute inset-y-0 w-px bg-line" style={{ left: `${scale.at(t)}%` }} />
      ))}
      <div className="absolute inset-x-0 top-1.5">
        {months.map((t, i) => {
          const [year, month] = ymd(t).split('-')
          return (
            <span
              key={t}
              className="absolute pl-1.5 font-medium whitespace-nowrap text-ink"
              style={{ left: `${scale.at(t)}%` }}
            >
              {monthName(t)}
              {(i === 0 || month === '01') && <span className="ml-1 font-normal text-muted">{year}</span>}
            </span>
          )
        })}
      </div>
      <div className="absolute inset-x-0 bottom-1.5 tabular-nums">
        {step !== undefined &&
          ticks.mondays
            .filter((_, i) => i % step === 0)
            .map((t) => (
              <span key={t} className="absolute pl-1" style={{ left: `${scale.at(t)}%` }}>
                {Number(ymd(t).slice(8))}
              </span>
            ))}
        {todayAt !== null && todayAt >= 0 && todayAt <= 100 && (
          <span
            className="absolute z-10 -translate-x-1/2 rounded bg-surface px-1 font-semibold whitespace-nowrap text-today-ink"
            style={{ left: `${todayAt}%` }}
          >
            {m.today()}
          </span>
        )}
      </div>
    </div>
  )
}
