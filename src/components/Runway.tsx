import { fmtDay, fmtShort } from '#/lib/format'
import { DAY, HOUR, parseLocal, startOfDay } from '#/lib/plan/dates'
import type { Plan, PlanEvent } from '#/lib/plan/types'
import { m } from '#/paraglide/messages.js'

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

const SEGMENT_LABEL = 'absolute top-3 text-[12.5px] font-semibold whitespace-nowrap'
const SEGMENT_DATES = 'ml-1.5 hidden font-normal text-muted md:inline'
const LAB_DONE =
  "bg-current after:h-[3px] after:w-1.5 after:transform-[rotate(-45deg)_translate(1px,-1px)] after:border-b-2 after:border-l-2 after:border-surface after:content-['']"

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
    <section
      className="mt-5 mb-4 grid items-center gap-x-7 gap-y-2 rounded-2xl border border-line bg-surface p-3.5 md:grid-cols-[auto_1fr] md:px-5 md:pt-[18px] md:pb-4"
      aria-label={m.runway_label()}
    >
      <div className="flex min-w-[150px] items-baseline gap-2.5 md:flex-col md:items-stretch md:gap-0">
        <b className="font-display text-[40px] leading-none font-bold tracking-[-0.03em] tabular-nums md:text-[54px]">
          {days === null ? '–' : Math.max(0, days)}
        </b>
        <span className="mt-1.5 text-[13px] text-muted">
          {days === null
            ? m.to_deadline()
            : days > 0
              ? m.days_to_deadline({ count: days })
              : days === 0
                ? m.deadline_today()
                : m.deadline_passed()}
        </span>
      </div>
      <div className="relative h-[92px]">
        <div className="absolute inset-x-0 top-10 h-3 overflow-hidden rounded-md bg-line-soft">
          {groups.map((g, i) => (
            <div
              key={g.name}
              className="absolute inset-y-0"
              style={{
                left: x(startOfDay(g.start)),
                width: `calc(${x(startOfDay(g.end) + DAY)} - ${x(startOfDay(g.start))})`,
                background: `color-mix(in srgb, ${color} ${i ? 45 : 85}%, var(--surface))`,
              }}
            />
          ))}
          {lastEnd < end && (
            <div
              className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--line)_5px_7px)]"
              style={{ left: x(lastEnd) }}
            />
          )}
        </div>
        {groups.map((g, i) => (
          <div key={g.name}>
            <div className={SEGMENT_LABEL} style={{ left: x(startOfDay(g.start)) }}>
              {g.name}
              <small className={SEGMENT_DATES}>
                {fmtShort(g.start)} – {fmtShort(g.end)}
              </small>
            </div>
            {g.labs.map((lab, j) => {
              const done = now !== null && parseLocal(lab.end) <= now
              return (
                <button
                  key={lab.uid}
                  type="button"
                  className={`absolute top-[35px] -ml-[11px] grid size-[22px] place-items-center rounded-full border-[3px] border-current text-[10px] leading-none font-bold ${done ? LAB_DONE : 'bg-surface'}`}
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
          <div className={SEGMENT_LABEL} style={{ left: x(lastEnd) }}>
            {m.reserve()}
            <small className={SEGMENT_DATES}>
              {fmtShort(lastEnd)} – {fmtShort(deadline)}
            </small>
          </div>
        )}
        {now !== null && now >= start && now < end && (
          <div className="absolute top-7 bottom-[22px] -ml-px w-0.5 bg-today" style={{ left: x(now) }}>
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[11.5px] font-semibold whitespace-nowrap text-today">{m.today()}</span>
          </div>
        )}
        <div className="absolute inset-x-0 top-16 flex justify-between text-[12px] text-muted">
          <span>{fmtDay(start)}</span>
          <span>{m.deadline_on({ date: fmtDay(deadline) })}</span>
        </div>
      </div>
    </section>
  )
}
