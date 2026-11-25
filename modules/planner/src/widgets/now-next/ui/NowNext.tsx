import { fmtDay, fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, isSession, startOfDay, type Occurrence, type Plan, type PlanEvent } from '@lc/plan-domain'
import { Button, calendarColor, Dot, Hint, Menu, Timer, type MenuItem } from '@lc/ui'
import { useState } from 'react'

import type { SessionActions } from '../../../shared/lib'
import { DoneMark } from '../../../shared/ui'

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
  actions?: SessionActions | undefined
}

type TodayState = 'done' | 'skipped' | 'now' | 'missed' | 'later'

/** The row's dot already names the course: `GE Agent Dev — ADK (1/3)` is listed as `ADK (1/3)`. */
const withoutCourse = (title: string) => title.replace(/^[^—]+— /, '')

/** Only a session that is not done can be timed: a gym slot or a finished session has nothing to log. */
const canFocus = (o: Occurrence) => isSession(o) && !o.done

function stateOf(o: Occurrence, now: number): TodayState {
  if (o.skipped) return 'skipped'
  if (o.done) return 'done'
  if (o.s <= now && now < o.e) return 'now'
  return o.e <= now ? 'missed' : 'later'
}

/**
 * The session in progress with the time left, or the next one with the time until it starts, and under it every
 * event of today with its state: done, skipped, now, missed or its time. Every session that is not done has its own
 * way into the focus page, so the one to sit down with is picked here: the next by the clock is not always the one.
 * With `actions`, a menu on each open session marks it done, skips it or moves it.
 */
export function NowNext({ plan, upcoming, now, onSelect, onFocus, actions }: Props) {
  const [noSlot, setNoSlot] = useState(false)
  if (now === null) return null
  const today = startOfDay(now)
  const current = upcoming.find((o) => o.s <= now && now < o.e)
  const next = upcoming.find((o) => o.s > now)
  const shown = current ?? next
  const colorOf = (o: Occurrence | undefined) => plan.calendars.find((c) => c.id === o?.calendar)?.color
  // Every event of the day, done and skipped ones too: the day reads as a whole, with what is left of it.
  const todays = upcoming.filter((o) => startOfDay(o.s) === today)

  function menuOf(o: Occurrence, state: TodayState): MenuItem[] {
    if (!actions || !isSession(o)) return []
    if (state === 'skipped') return [{ id: 'unskip', label: m.unskip_session(), run: () => actions.unskip(o.uid) }]
    if (state === 'done') return []
    return [
      { id: 'done', label: m.mark_done(), run: () => actions.done(o.uid) },
      { id: 'skip', label: m.skip_session(), run: () => actions.skip(o.uid) },
      { id: 'move', label: m.move_next_free(), run: () => setNoSlot(!actions.move(o)) },
    ]
  }

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
              icon={<Timer size={15} aria-hidden />}
              label={m.focus_start_this()}
              onClick={() => onFocus(shown.uid)}
            />
          )}
        </>
      ) : (
        <p className="mt-2 text-[13.5px] text-muted">{m.nothing_planned()}</p>
      )}
      {todays.length > 0 && (
        <>
          <h3 className="mt-3.5 border-t border-line-soft pt-3 text-[11.5px] font-semibold tracking-wide text-muted uppercase">
            {m.today_title()}
          </h3>
          <ul className="mt-1 grid grid-cols-[minmax(0,1fr)] gap-0.5">
            {todays.map((o) => {
              const state = stateOf(o, now)
              const menu = menuOf(o, state)
              const closed = state === 'done' || state === 'skipped'
              return (
                <li
                  key={`${o.uid}-${o.s}`}
                  className="flex min-w-0 items-center gap-1"
                  style={calendarColor(colorOf(o))}
                >
                  <button
                    type="button"
                    className={`-ml-1.5 flex min-w-0 flex-1 items-baseline gap-2 rounded-md px-1.5 py-1 text-left text-[13px]/[1.35] hover:bg-surface-2 ${state === 'now' ? 'bg-surface-2 font-semibold' : ''}`}
                    data-tip={o.title}
                    onClick={() => onSelect(o)}
                  >
                    <Dot className={`size-2 flex-none -translate-y-px ${closed ? 'opacity-45' : ''}`} />
                    <span
                      className={`min-w-0 flex-1 truncate ${closed ? 'text-muted line-through' : ''} ${state === 'skipped' ? 'decoration-today' : 'decoration-done'}`}
                    >
                      {withoutCourse(o.title)}
                    </span>
                    <span
                      className={`flex flex-none items-center gap-1 text-[12px] tabular-nums ${state === 'missed' ? 'text-today-ink' : state === 'now' ? 'text-focus' : 'text-muted'}`}
                    >
                      {state === 'done' && <DoneMark unlogged={false} className="inline-block" />}
                      {state === 'missed'
                        ? m.missed()
                        : state === 'skipped'
                          ? m.skipped_mark()
                          : state === 'now'
                            ? m.now_short()
                            : hm(o.s)}
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
                  {menu.length > 0 && (
                    <Menu
                      label={m.session_actions({ title: o.title })}
                      items={menu}
                      className="size-7! rounded-md! border-0! bg-transparent! text-[15px]! shadow-none!"
                    />
                  )}
                </li>
              )
            })}
          </ul>
          {noSlot && (
            <p className="mt-2 text-[12.5px] text-today-ink" role="status">
              {m.free_slot_none()}
            </p>
          )}
        </>
      )}
    </section>
  )
}
