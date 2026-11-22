import { DAY, HOUR, dowShort, fmtDay, hm, startOfDay, ymd } from '#/lib/plan/dates'
import { durationHours, type Occurrence } from '#/lib/plan/occurrences'
import type { Plan, PlanEvent } from '#/lib/plan/types'

interface Props {
  plan: Plan
  weekStart: number
  items: Occurrence[]
  now: number | null
  onSelect: (e: PlanEvent) => void
}

const PX_PER_HOUR = 56

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
      <div className="gridwrap">
        <div className="week">
          <div className="head" />
          {days.map((d) => {
            const off = plan.meta.holidays.includes(ymd(d))
            return (
              <div key={d} className={`head${d === today ? ' today' : ''}${off ? ' off' : ''}`}>
                {dowShort(d)}
                <b>{new Date(d).getUTCDate()}</b>
                {off && <small>выходной</small>}
              </div>
            )
          })}

          {allDay.length > 0 && (
            <>
              <div className="head allday-label">весь день</div>
              <div className="allday">
                {allDay.map((o) => (
                  <button key={o.uid} type="button" onClick={() => onSelect(o)}>
                    {fmtDay(o.s)}: {o.title}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="times" style={{ height }}>
            {hours.map((h) => (
              <span key={h} style={{ top: (h - minH) * PX_PER_HOUR }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {days.map((d) => (
            <div key={d} className="col" style={{ height }}>
              {hours.map((h) => (
                <div key={h} className="hr" style={{ top: (h - minH) * PX_PER_HOUR }} />
              ))}
              {timed
                .filter((o) => startOfDay(o.s) === d)
                .map((o) => (
                  <button
                    key={`${o.uid}-${o.s}`}
                    type="button"
                    className={`ev${o.availability === 'free' ? ' free' : ''}${o.kind === 'lab' ? ' lab' : ''}`}
                    style={
                      {
                        '--c': colorOf(o.calendar),
                        top: ((o.s - d) / HOUR - minH) * PX_PER_HOUR + 1,
                        height: Math.max(22, durationHours(o) * PX_PER_HOUR - 3),
                      } as React.CSSProperties
                    }
                    onClick={() => onSelect(o)}
                  >
                    <b>{shortTitle(o)}</b>
                    <small>
                      {hm(o.s)}–{hm(o.e)}
                    </small>
                  </button>
                ))}
              {now !== null && startOfDay(now) === d && (now - d) / HOUR >= minH && (now - d) / HOUR <= maxH && (
                <div className="nowline" style={{ top: ((now - d) / HOUR - minH) * PX_PER_HOUR }} />
              )}
            </div>
          ))}
        </div>
      </div>
      {!items.length && <div className="empty">На этой неделе событий нет. Включите календари выше или перейдите к другой неделе.</div>}
    </>
  )
}
