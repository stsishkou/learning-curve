import { DAY, HOUR, fmtDay, fmtShort, parseLocal, plural, startOfDay } from '#/lib/plan/dates'
import type { Plan, PlanEvent } from '#/lib/plan/types'

interface Props {
  plan: Plan
  now: number | null
  onSelect: (e: PlanEvent) => void
}

interface Group {
  name: string
  start: number
  end: number
  labs: PlanEvent[]
}

/** Horizontal strip from the first certificate session to the deadline, with a marker per challenge lab. */
export function Runway({ plan, now, onSelect }: Props) {
  const certs = plan.events.filter((e) => e.calendar === 'certs' && !e.allDay)
  const color = plan.calendars.find((c) => c.id === 'certs')?.color ?? '#2F5BEA'
  if (!certs.length) return null

  const deadline = parseLocal(plan.meta.certDeadline)
  const start = startOfDay(Math.min(...certs.map((e) => parseLocal(e.start))))
  const end = deadline + DAY
  const x = (t: number) => `${Math.max(0, Math.min(100, ((t - start) / (end - start)) * 100))}%`

  const groups: Group[] = []
  for (const e of certs) {
    const name = e.title.split(' — ')[0]
    let g = groups.find((it) => it.name === name)
    if (!g) groups.push((g = { name, start: parseLocal(e.start), end: parseLocal(e.end), labs: [] }))
    g.end = Math.max(g.end, parseLocal(e.end))
    if (e.kind === 'lab') g.labs.push(e)
  }
  const lastEnd = Math.max(...groups.map((g) => startOfDay(g.end) + DAY))
  const days = now === null ? null : Math.ceil((deadline - startOfDay(now)) / DAY)

  return (
    <section className="runway" aria-label="Сертификаты до дедлайна">
      <div className="countdown">
        <b>{days === null ? '–' : Math.max(0, days)}</b>
        <span>
          {days === null
            ? 'до дедлайна сертификатов'
            : days > 0
              ? `${plural(days, 'день', 'дня', 'дней')} до дедлайна сертификатов`
              : days === 0
                ? 'дедлайн сегодня'
                : 'дедлайн прошёл'}
        </span>
      </div>
      <div className="track">
        <div className="rail">
          {groups.map((g, i) => (
            <div
              key={g.name}
              className="seg"
              style={{
                left: x(startOfDay(g.start)),
                width: `calc(${x(startOfDay(g.end) + DAY)} - ${x(startOfDay(g.start))})`,
                background: `color-mix(in srgb, ${color} ${i ? 45 : 85}%, var(--surface))`,
              }}
            />
          ))}
          {lastEnd < end && <div className="seg reserve" style={{ left: x(lastEnd), right: 0 }} />}
        </div>
        {groups.map((g, i) => (
          <div key={g.name}>
            <div className="seglabel" style={{ left: x(startOfDay(g.start)) }}>
              {g.name}
              <small>
                {fmtShort(g.start)} – {fmtShort(g.end)}
              </small>
            </div>
            {g.labs.map((lab, j) => {
              const done = now !== null && parseLocal(lab.end) <= now
              return (
                <button
                  key={lab.uid}
                  type="button"
                  className={`lab${done ? ' done' : ''}`}
                  style={{ left: x(parseLocal(lab.start) + 12 * HOUR), color: i ? `color-mix(in srgb, ${color} 60%, var(--ink))` : color }}
                  title={`${lab.title} — ${fmtDay(parseLocal(lab.start))}`}
                  aria-label={`${lab.title}, ${fmtDay(parseLocal(lab.start))}`}
                  onClick={() => onSelect(lab)}
                >
                  {done ? '' : j + 1}
                </button>
              )
            })}
          </div>
        ))}
        {lastEnd < end && (
          <div className="seglabel" style={{ left: x(lastEnd) }}>
            Резерв
            <small>
              {fmtShort(lastEnd)} – {fmtShort(deadline)}
            </small>
          </div>
        )}
        {now !== null && now >= start && now < end && <div className="nowmark" style={{ left: x(now) }} />}
        <div className="ends">
          <span>{fmtDay(start)}</span>
          <span>Дедлайн: {fmtDay(deadline)}</span>
        </div>
      </div>
    </section>
  )
}
