import { dowShort, fmtDay } from '#/lib/format'
import { DAY, HOUR, hm, startOfDay, ymd } from '#/lib/plan/dates'
import { durationHours, type Occurrence } from '#/lib/plan/occurrences'
import type { Plan, PlanEvent } from '#/lib/plan/types'
import { m } from '#/paraglide/messages.js'

import { calendarColor } from './ui'

interface Props {
  plan: Plan
  weekStart: number
  items: Occurrence[]
  now: number | null
  onSelect: (e: PlanEvent) => void
}

const PX_PER_HOUR = 56

const HEAD = 'border-b border-line text-muted'
const DAY_OFF = 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--line-soft)_6px_8px)]'
const EVENT =
  'absolute inset-x-1 overflow-hidden rounded-lg border-l-4 border-cal px-[7px] py-[5px] text-left text-[12px]/[1.3] text-ink'
const EVENT_BUSY =
  'bg-[color-mix(in_srgb,var(--c)_16%,var(--surface))] hover:bg-[color-mix(in_srgb,var(--c)_26%,var(--surface))]'
const EVENT_FREE =
  'border-dashed bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--c)_10%,var(--surface))_0_6px,var(--surface)_6px_12px)]'
const EVENT_LAB = 'shadow-[inset_0_0_0_1.5px_var(--c)]'

const shortTitle = (o: Occurrence) =>
  o.kind === 'study' || o.kind === 'lab' ? o.title.replace(/^[^—]+— /, '') : o.title

export function WeekGrid({ plan, weekStart, items, now, onSelect }: Props) {
  const timed = items.filter((o) => !o.allDay)
  const allDay = items.filter((o) => o.allDay)
  let minH = 8
  let maxH = 15
  for (const o of timed) {
    minH = Math.min(minH, new Date(o.s).getUTCHours())
    maxH = Math.max(maxH, Math.ceil((o.e - startOfDay(o.e)) / HOUR) || 24)
  }
  const height = (maxH - minH) * PX_PER_HOUR
  const hours = Array.from({ length: maxH - minH - 1 }, (_, i) => minH + 1 + i)
  const days = Array.from({ length: 7 }, (_, i) => weekStart + i * DAY)
  const today = now === null ? null : startOfDay(now)
  const colorOf = (id: string) => plan.calendars.find((c) => c.id === id)?.color ?? '#888'

  return (
    <>
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-[52px_repeat(7,minmax(96px,1fr))]">
          <div className={HEAD} />
          {days.map((d) => {
            const off = plan.meta.holidays.includes(ymd(d))
            return (
              <div key={d} className={`${HEAD} px-2 pt-2.5 pb-2 text-[13px] ${off ? DAY_OFF : ''}`}>
                {dowShort(d)}
                <b
                  className={`block text-[18px]/[1.1] font-semibold tabular-nums ${d === today ? 'text-today' : 'text-ink'}`}
                >
                  {new Date(d).getUTCDate()}
                </b>
                {off && <small className="mt-0.5 block text-[11px] text-today">{m.day_off()}</small>}
              </div>
            )
          })}

          {allDay.length > 0 && (
            <>
              <div className={`${HEAD} px-2 py-1.5 text-[11px]`}>{m.all_day()}</div>
              <div className="col-[2/-1] flex flex-wrap gap-1.5 border-b border-line-soft px-2 py-1.5">
                {allDay.map((o) => (
                  <button
                    key={o.uid}
                    type="button"
                    className="rounded-md bg-[color-mix(in_srgb,var(--today)_14%,var(--surface))] px-2 py-[3px] text-[12px] font-semibold text-today"
                    onClick={() => onSelect(o)}
                  >
                    {fmtDay(o.s)}: {o.title}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="relative border-r border-line-soft" style={{ height }}>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11.5px] text-muted tabular-nums"
                style={{ top: (h - minH) * PX_PER_HOUR }}
              >
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {days.map((d) => (
            <div key={d} className="relative border-r border-line-soft last:border-r-0" style={{ height }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-line-soft"
                  style={{ top: (h - minH) * PX_PER_HOUR }}
                />
              ))}
              {timed
                .filter((o) => startOfDay(o.s) === d)
                .map((o) => (
                  <button
                    key={`${o.uid}-${o.s}`}
                    type="button"
                    className={`${EVENT} ${o.availability === 'free' ? EVENT_FREE : EVENT_BUSY} ${o.kind === 'lab' ? EVENT_LAB : ''}`}
                    style={{
                      ...calendarColor(colorOf(o.calendar)),
                      top: ((o.s - d) / HOUR - minH) * PX_PER_HOUR + 1,
                      height: Math.max(22, durationHours(o) * PX_PER_HOUR - 3),
                    }}
                    onClick={() => onSelect(o)}
                  >
                    <b className="block font-semibold">{shortTitle(o)}</b>
                    <small className="text-muted tabular-nums">
                      {hm(o.s)}–{hm(o.e)}
                    </small>
                  </button>
                ))}
              {now !== null && startOfDay(now) === d && (now - d) / HOUR >= minH && (now - d) / HOUR <= maxH && (
                <div
                  className="absolute inset-x-0 z-2 h-0.5 bg-today before:absolute before:-top-[3px] before:-left-1 before:size-2 before:rounded-full before:bg-today before:content-['']"
                  style={{ top: ((now - d) / HOUR - minH) * PX_PER_HOUR }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      {!items.length && <div className="px-[18px] py-10 text-center text-muted">{m.no_events_this_week()}</div>}
    </>
  )
}
