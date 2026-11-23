import { fmtDay, fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, isSession, startOfDay, type Occurrence, type Plan, type PlanEvent } from '@lc/plan-domain'
import { Button, calendarColor, Dot, Hint, Timer } from '@lc/ui'

interface Props {
  plan: Plan
  /** Timed events from today on, in order */
  upcoming: Occurrence[]
  /** Minsk wall-clock ms; null before the clock is known, as on the server */
  now: number | null
  /** Called with the event that was clicked: the page opens its dialog */
  onSelect: (e: PlanEvent) => void
  /** Present when there is a focus page: called with the uid of the session to time there */
  onFocus?: ((uid: string) => void) | undefined
}

/** How many other events of today are listed under the main one */
const MORE = 4

/** Only a session that is not done can be timed: a gym slot or a finished session has nothing to log. */
/** The row's dot already names the course: `GE Agent Dev — ADK (1/3)` is listed as `ADK (1/3)`. */
const withoutCourse = (title: string) => title.replace(/^[^—]+— /, '')

const canFocus = (o: Occurrence) => isSession(o) && !o.done

/**
 * The session in progress with the time left, or the next one with the time until it starts, and under it the
 * rest of today. Every session that is not done has its own way into the focus page, so the one to sit down
 * with is picked here: the next by the clock is not always the one.
 */
export function NowNext({ plan, upcoming, now, onSelect, onFocus }: Props) {
  if (now === null) return null
  const today = startOfDay(now)
  const current = upcoming.find((o) => o.s <= now && now < o.e)
  const next = upcoming.find((o) => o.s > now)
  const shown = current ?? next
  const colorOf = (o: Occurrence | undefined) => plan.calendars.find((c) => c.id === o?.calendar)?.color
  // The rest of today: what is still ahead, and what was missed and can still be done.
  const rest = upcoming
    .filter((o) => o !== shown && startOfDay(o.s) === today && (o.e > now || canFocus(o)))
    .slice(0, MORE)

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-4" style={calendarColor(colorOf(shown))}>
      <h2 className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-muted uppercase">
        {current && (
          // A few beats when the session starts, not for its whole length: blinking that goes on distracts.
          <i className="size-2 rounded-full bg-today motion-safe:animate-pulse motion-safe:[animation-iteration-count:2]" />
        )}
        {current ? m.now_label() : m.next_label()}
        <Hint title={m.help_next_title()} text={m.help_next()} />
        {shown && (
          <em className="ml-auto font-medium tracking-normal normal-case not-italic tabular-nums">
            {current
              ? m.ends_in({ time: fmtDuration(current.e - now) })
              : m.starts_in({ time: fmtDuration(shown.s - now) })}
          </em>
        )}
      </h2>
      {shown ? (
        <>
          <button type="button" className="mt-2 block w-full text-left" onClick={() => onSelect(shown)}>
            <b className="flex items-baseline gap-2 text-[14.5px]/[1.35] font-semibold">
              <Dot className="size-2.5 -translate-y-px" />
              <span className="min-w-0">{shown.title}</span>
            </b>
            <span className="mt-1 block pl-[18px] text-[12.5px] text-muted tabular-nums">
              {startOfDay(shown.s) === today ? m.today() : fmtDay(shown.s)}, {hm(shown.s)}–{hm(shown.e)}
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
          {onFocus && canFocus(shown) && (
            <Button
              className="mt-3 flex w-full items-center justify-center gap-1.5 text-[13.5px]"
              onClick={() => onFocus(shown.uid)}
            >
              <Timer size={15} aria-hidden /> {m.focus_start_this()}
            </Button>
          )}
        </>
      ) : (
        <p className="mt-2 text-[13.5px] text-muted">{m.nothing_planned()}</p>
      )}
      {rest.length > 0 && (
        <>
          <h3 className="mt-3.5 border-t border-line-soft pt-3 text-[11.5px] font-semibold tracking-wide text-muted uppercase">
            {m.today_also()}
          </h3>
          <ul className="mt-1 grid grid-cols-[minmax(0,1fr)] gap-0.5">
            {rest.map((o) => (
              <li key={`${o.uid}-${o.s}`} className="flex min-w-0 items-center gap-1" style={calendarColor(colorOf(o))}>
                <button
                  type="button"
                  className="-ml-1.5 flex min-w-0 flex-1 items-baseline gap-2 rounded-md px-1.5 py-1 text-left text-[13px]/[1.35] hover:bg-surface-2"
                  data-tip={o.title}
                  onClick={() => onSelect(o)}
                >
                  <Dot className="size-2 flex-none -translate-y-px" />
                  <span className={`min-w-0 flex-1 truncate ${o.done ? 'text-muted line-through' : ''}`}>
                    {withoutCourse(o.title)}
                  </span>
                  <span
                    className={`flex-none text-[12px] tabular-nums ${o.e <= now ? 'text-today-ink' : 'text-muted'}`}
                  >
                    {o.e <= now ? m.missed() : hm(o.s)}
                  </span>
                </button>
                {onFocus && canFocus(o) && (
                  <button
                    type="button"
                    className="grid size-7 flex-none place-items-center rounded-md text-focus hover:bg-surface-2"
                    aria-label={m.focus_on({ title: o.title })}
                    data-tip={m.focus_on({ title: o.title })}
                    onClick={() => onFocus(o.uid)}
                  >
                    <Timer size={15} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
