import { fmtDay, fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, startOfDay, type Occurrence, type Plan, type PlanEvent } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'

interface Props {
  plan: Plan
  /** Timed events from today on, in order */
  upcoming: Occurrence[]
  now: number | null
  onSelect: (e: PlanEvent) => void
}

/** The session in progress with the time left, or the next one with the time until it starts. */
export function NowNext({ plan, upcoming, now, onSelect }: Props) {
  if (now === null) return null
  const current = upcoming.find((o) => o.s <= now && now < o.e)
  const next = upcoming.find((o) => o.s > now)
  const shown = current ?? next
  const color = plan.calendars.find((c) => c.id === shown?.calendar)?.color

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-4" style={calendarColor(color)}>
      <h2 className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-muted uppercase">
        {current && <i className="size-2 animate-pulse rounded-full bg-today" />}
        {current ? m.now_label() : m.next_label()}
        {shown && (
          <em className="ml-auto font-medium tracking-normal normal-case not-italic tabular-nums">
            {current
              ? m.ends_in({ time: fmtDuration(current.e - now) })
              : m.starts_in({ time: fmtDuration(shown.s - now) })}
          </em>
        )}
      </h2>
      {shown ? (
        <button type="button" className="mt-2 block w-full text-left" onClick={() => onSelect(shown)}>
          <b className="flex items-baseline gap-2 text-[14.5px]/[1.35] font-semibold">
            <Dot className="size-2.5 -translate-y-px" />
            <span className="min-w-0">{shown.title}</span>
          </b>
          <span className="mt-1 block pl-[18px] text-[12.5px] text-muted tabular-nums">
            {startOfDay(shown.s) === startOfDay(now) ? m.today() : fmtDay(shown.s)}, {hm(shown.s)}–{hm(shown.e)}
          </span>
          {current && (
            <span className="mt-2.5 block h-1.5 overflow-hidden rounded bg-line-soft">
              <i
                className="block h-full rounded bg-cal"
                style={{ width: `${((now - current.s) / (current.e - current.s)) * 100}%` }}
              />
            </span>
          )}
        </button>
      ) : (
        <p className="mt-2 text-[13.5px] text-muted">{m.nothing_planned()}</p>
      )}
      {current && next && (
        <button
          type="button"
          className="mt-3 block w-full border-t border-line-soft pt-2.5 text-left text-[12.5px] text-muted hover:text-ink"
          onClick={() => onSelect(next)}
        >
          {m.then_label()} {next.title} · {hm(next.s)}
        </button>
      )}
    </section>
  )
}
