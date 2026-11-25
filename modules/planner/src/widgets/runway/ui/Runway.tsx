import { fmtDay, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  DAY,
  HOUR,
  countdown,
  deadlineEvent,
  deadlinesAhead,
  isDone,
  isSession,
  parseLocal,
  type Plan,
  type PlanEvent,
  startOfDay,
} from '@lc/plan-domain'
import { Button, calendarColor, Dot, Hint, Pencil } from '@lc/ui'

interface Props {
  plan: Plan
  /** Minsk wall-clock ms; null before the clock is known, as on the server */
  now: number | null
  /** Called with the challenge lab whose marker was clicked */
  onSelect: (e: PlanEvent) => void
  /** Present where the plan can be changed: opens the settings of the countdown */
  onConfigure?: (() => void) | undefined
  /** Present where the plan can be changed: re-balances the course when its sessions run past the deadline */
  onReschedule?: ((calendar: string) => void) | undefined
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

/**
 * Horizontal strip from the first session of a course to its deadline, with a marker per lab: the course the plan
 * names for the countdown, or the one with the nearest deadline. Before the clock is known (on the server) it shows
 * the earliest deadline of the plan.
 */
export function Runway({ plan, now, onSelect, onConfigure, onReschedule }: Props) {
  const target = countdown(plan, now ?? 0)
  const calendar = target && plan.calendars.find((c) => c.id === target.calendar)
  if (!target || !calendar || target.day === null) {
    if (!onConfigure) return null
    return (
      <section
        className="mt-5 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface p-3.5 md:px-5 print:hidden"
        aria-label={m.countdown_title()}
      >
        <p className="mr-auto text-[14px] text-muted">
          {target && calendar ? m.countdown_no_deadline({ name: calendar.name }) : m.countdown_empty()}
        </p>
        <Button
          className="flex items-center gap-1.5"
          icon={<Pencil size={15} aria-hidden />}
          label={m.countdown_set()}
          onClick={onConfigure}
        />
      </section>
    )
  }
  const { color } = calendar
  const certs = plan.events.filter((e) => e.calendar === calendar.id && !e.allDay)

  const deadline = parseLocal(`${target.day}T00:00`)
  // A course with a deadline but no sessions yet runs from today.
  const starts = certs.length ? certs.map((e) => parseLocal(e.start)) : [Math.min(now ?? deadline, deadline)]
  const start = startOfDay(Math.min(...starts))
  const end = deadline + DAY
  const x = (t: number) => `${Math.max(0, Math.min(100, ((t - start) / (end - start)) * 100))}%`

  const groups: Group[] = []
  for (const e of certs) {
    const cut = e.title.indexOf(' — ')
    const name = cut === -1 ? e.title : e.title.slice(0, cut)
    let g = groups.find((it) => it.name === name)
    if (!g) groups.push((g = { name, start: parseLocal(e.start), end: parseLocal(e.end), labs: [] }))
    g.end = Math.max(g.end, parseLocal(e.end))
    if (e.kind === 'lab') g.labs.push(e)
  }
  const lastEnd = groups.length ? Math.max(...groups.map((g) => startOfDay(g.end) + DAY)) : start
  const days = now === null ? null : Math.ceil((deadline - startOfDay(now)) / DAY)
  const open = certs.filter((e) => isSession(e) && !e.done)
  const passed = days !== null && days < 0 && open.length > 0
  const late = open.filter((e) => parseLocal(e.end) > end).length
  const today = now === null ? null : startOfDay(now)
  const ahead = today === null ? [] : deadlinesAhead(plan, today).filter((d) => d.calendar !== calendar.id)

  return (
    <section
      className="relative mt-5 mb-4 grid grid-cols-[minmax(0,1fr)] items-center gap-x-7 gap-y-2 rounded-2xl border border-line bg-surface p-3.5 md:grid-cols-[auto_1fr] md:px-5 md:pt-[18px] md:pb-4 print:hidden"
      aria-label={m.runway_label({ name: calendar.name })}
    >
      <Hint title={m.help_runway_title()} text={m.help_runway()} className="absolute top-2 right-2" />
      <div className="flex min-w-[150px] flex-col gap-2 md:gap-2.5">
        <div className="flex items-baseline gap-2.5 md:flex-col md:items-stretch md:gap-0">
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
        {/* Whose deadline the days count to, and its day: the number means nothing without them. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:flex-col md:items-start">
          <span
            className="flex items-center gap-1.5 text-[13px] font-semibold"
            data-tip={deadlineEvent(plan, calendar.id)?.title}
          >
            <span className="size-2 flex-none rounded-full" style={{ background: color }} aria-hidden />
            {calendar.name} · {fmtDay(deadline)}
          </span>
          {onConfigure && (
            <Button
              className="flex items-center gap-1.5 py-1! text-[13px]"
              icon={<Pencil size={14} aria-hidden />}
              label={m.countdown_edit()}
              data-tip={m.countdown_edit_hint()}
              onClick={onConfigure}
            />
          )}
        </div>
        {(passed || late > 0) && (
          <p className="flex flex-wrap items-baseline gap-x-3 text-[13px] text-today-ink">
            <span>{passed ? m.runway_open_after({ count: open.length }) : m.runway_late({ count: late })}</span>
            {onReschedule && (
              <button
                type="button"
                className="font-semibold text-focus hover:underline"
                aria-label={m.reschedule_course({ name: calendar.name })}
                onClick={() => onReschedule(calendar.id)}
              >
                {m.reschedule()}
              </button>
            )}
          </p>
        )}
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
              const done = isDone(lab)
              return (
                <button
                  key={lab.uid}
                  type="button"
                  className={`absolute top-[35px] -ml-[11px] grid size-[22px] place-items-center rounded-full border-[3px] border-current text-[10px] leading-none font-bold ${done ? LAB_DONE : 'bg-surface'}`}
                  style={{
                    left: x(parseLocal(lab.start) + 12 * HOUR),
                    color: i ? `color-mix(in srgb, ${color} 60%, var(--ink))` : color,
                  }}
                  data-tip={`${lab.title} — ${fmtDay(parseLocal(lab.start))}`}
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
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[11.5px] font-semibold whitespace-nowrap text-today-ink">
              {m.today()}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 top-16 flex justify-between text-[12px] text-muted">
          {/* Today's own label stands in the same place during the first days. */}
          <span className={now !== null && now >= start && now - start < (end - start) / 8 ? 'invisible' : ''}>
            {fmtDay(start)}
          </span>
          <span>{m.deadline_on({ date: fmtDay(deadline) })}</span>
        </div>
      </div>
      {today !== null && ahead.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-line-soft pt-2.5 text-[12.5px] md:col-span-2">
          <h3 className="font-semibold text-muted">{m.runway_ahead()}</h3>
          <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-1">
            {ahead.map(({ calendar: id, day }) => {
              const other = plan.calendars.find((c) => c.id === id)
              const at = parseLocal(`${day}T00:00`)
              const left = Math.round((at - today) / DAY)
              return (
                <li key={id} className="flex min-w-0 items-center gap-1.5" style={calendarColor(other?.color)}>
                  <Dot className="size-2 flex-none" />
                  <span className="max-w-[28ch] truncate" data-tip={other?.name}>
                    {other?.name}
                  </span>
                  <span className="whitespace-nowrap text-muted tabular-nums">
                    {fmtDay(at)} · {left ? m.runway_in_days({ count: left }) : m.today()}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
