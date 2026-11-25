import { fmtDay, fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, isSession, parseLocal, startOfDay, type Plan, type PlanChange, type PlanEvent } from '@lc/plan-domain'
import {
  Button,
  calendarColor,
  Check,
  Coffee,
  Dot,
  ExternalLink,
  HelpToggle,
  IconsToggle,
  Hint,
  PageHeader,
  Pause,
  Play,
  RotateCcw,
  useFullscreen,
  useShortcuts,
} from '@lc/ui'
import { useRef, useState, type ReactNode } from 'react'

import { useFillHeight, useNow } from '../../../shared/lib'
import { ScreenButtons } from '../../../shared/ui'
import { Hourglass } from '../../../widgets/hourglass'
import { finishRecord, loggedMinutes } from '../model/finish'
import { useGlass } from '../model/use-glass'
import { useStopwatch } from '../model/use-stopwatch'
import { useTitleLead } from '../model/use-title-lead'
import { GlassControls } from './GlassControls'

interface Props {
  plan: Plan
  /** false on a read-only host: the time can be measured but not logged */
  canEdit: boolean
  /** uid of the session to time, as the host keeps it (in the URL); without it the page picks by the clock */
  session?: string | undefined
  /** Called with the uid picked from the queue, or with undefined once it is finished: the host stores it */
  onPick?: (uid: string | undefined) => void
  /** Stores one change. Rejects with the reason when it cannot be stored: the page shows it */
  onChange: (change: PlanChange) => Promise<void>
  /** Shown next to the title: controls the host owns, such as the sections of the app */
  headerAside?: ReactNode
  /** Minsk wall-clock ms to take as the present, for a fixed picture in a story; the real clock otherwise */
  now?: number
  /** The stopwatch takes the whole window: no page header */
  expanded?: boolean | undefined
  /** Present when the host keeps `expanded`: the page then offers Expand */
  onExpandedChange?: ((expanded: boolean) => void) | undefined
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
/** How many sessions the queue lists */
const QUEUE = 6
const URL_PATTERN = /https?:\/\/\S+/

const two = (value: number) => String(value).padStart(2, '0')
/** `25:04`, or `1:05:04` from an hour on */
function stopwatchText(ms: number) {
  const seconds = Math.floor(ms / 1000)
  const rest = `${two(Math.floor(seconds / 60) % 60)}:${two(seconds % 60)}`
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}:${rest}` : rest
}

// Whole multiples of the glass's 39 × 63 cells, so it fills its box at one, two and three device pixels per CSS pixel.
const GLASS_BOX = 'h-[126px] w-[78px] md:h-[189px] md:w-[117px]'
const DIGITS = 'text-[72px]/[1] md:text-[104px]/[1]'
// Expand and Full screen. From md up the card has the screen's height and the watch row takes what the rest of the
// card leaves, as a size container: the glass is as tall as the row (`--glass`) unless that would take more than
// 38% of its width from the digits, and the digits take the width it leaves (`--beside`), counted in their own width
// in em (`--digits`). On a phone the page scrolls instead.
const WIDE_ROW =
  'self-stretch md:min-h-[220px] md:flex-1 md:gap-x-16 md:[container-type:size] md:[--glass:min(100cqh,calc(38cqw*63/39))]'
const WIDE_GLASS_BOX =
  'h-[min(42dvh,320px)] w-[calc(min(42dvh,320px)*39/63)] md:h-[var(--glass)] md:w-[calc(var(--glass)*39/63)]'
const WIDE_DIGITS =
  'text-[72px]/[1] md:text-[clamp(64px,min(calc((100cqw_-_var(--beside))/var(--digits)),calc(100cqh_-_120px)),240px)]/[1]'
const BESIDE = { glass: '[--beside:calc(var(--glass)*39/63_+_4rem)]', alone: '[--beside:0px]' }
/** The digits' width in em, for `25:04` and for `1:05:04` in the display font, with a little to spare */
const DIGITS_EM = { minutes: '[--digits:3.5]', hours: '[--digits:4.6]' }

/**
 * One session and a stopwatch. Start it when you sit down; `Finish` marks the session done and logs the time it
 * really took, which is what the pace forecast is worked out from. The session is the one in progress, or the next
 * one that is not done; any other from the queue can be picked.
 */
export function FocusPage(props: Props) {
  const { plan, canEdit, session: wanted, onPick, onChange, headerAside, now: fixed } = props
  const { expanded = false, onExpandedChange } = props
  const clock = useNow()
  const now = fixed ?? clock
  const watch = useStopwatch()
  // Without a host that keeps the choice, the page keeps it itself.
  const [own, setOwn] = useState<string | undefined>(undefined)
  const picked = wanted ?? own
  const pick = (uid: string | undefined) => (onPick ? onPick(uid) : setOwn(uid))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [logged, setLogged] = useState<{ title: string; minutes: number } | null>(null)

  const open = plan.events
    .filter((e) => isSession(e) && !e.done)
    .toSorted((a, b) => parseLocal(a.start) - parseLocal(b.start))
  // What is left of today comes first, missed sessions included; then what follows.
  const today = now === null ? null : startOfDay(now)
  const queue = (today === null ? open : open.filter((e) => parseLocal(e.start) >= today)).slice(0, QUEUE)
  const inProgress = now === null ? undefined : queue.find((e) => parseLocal(e.start) <= now && now < parseLocal(e.end))
  const upcoming = now === null ? undefined : queue.find((e) => parseLocal(e.end) > now)
  const byUid = (uid: string | null | undefined) => open.find((e) => e.uid === uid)
  // A running stopwatch keeps its session whatever was picked since: its time must not be dropped by a link.
  // Paused time comes next to the pick, so a reload does not switch away from it.
  const session =
    (watch.running ? byUid(watch.timed) : undefined) ??
    byUid(picked) ??
    byUid(watch.timed) ??
    inProgress ??
    upcoming ??
    queue[0] ??
    open[0] ??
    null
  // The picked session is listed even when the queue of the day does not reach it.
  const listed = session && !queue.includes(session) ? [session, ...queue] : queue

  const planned = session ? parseLocal(session.end) - parseLocal(session.start) : 0
  const running = watch.running && watch.timed === session?.uid
  const glass = useGlass(session?.uid ?? null, planned, watch)
  const { elapsed, block, rhythm, settings } = glass
  // Drawn once the stored state and the clock are known, so it does not turn over while the page settles.
  const showGlass = !settings.hidden && glass.ready && now !== null
  const minutesLeft = Math.ceil((block.length - block.run) / MINUTE)
  useTitleLead(
    glass.due
      ? m.focus_title_due()
      : glass.resting
        ? m.focus_title_break({ minutes: minutesLeft })
        : glass.rested
          ? m.focus_break_end()
          : !running
            ? null
            : glass.out
              ? m.focus_title_out()
              : rhythm
                ? m.focus_break_in({ minutes: minutesLeft })
                : m.focus_title_left({ minutes: minutesLeft }),
  )
  const color = plan.calendars.find((c) => c.id === session?.calendar)?.color
  const fullscreen = useFullscreen()
  // The whole screen is for the stopwatch: it is laid out as Expand lays it out.
  const wide = expanded || fullscreen.on
  const toggleExpanded = onExpandedChange && (() => onExpandedChange(!expanded))
  const columns = useRef<HTMLDivElement>(null)
  const fill = useFillHeight(columns, wide, { minWidth: 701, bottomGap: 16 })

  useShortcuts({
    ...(toggleExpanded && { e: toggleExpanded }),
    ...(fullscreen.supported && { 'shift+f': fullscreen.toggle }),
  })
  const courseUrl = session?.description.match(URL_PATTERN)?.[0]
  const courseLink = courseUrl && (
    <a
      className="flex items-center gap-1.5 text-[13.5px] text-focus hover:underline"
      href={courseUrl}
      target="_blank"
      rel="noreferrer"
    >
      {m.open_course()} <ExternalLink size={14} aria-hidden />
    </a>
  )
  // In Expand the link goes up beside the screen buttons, to leave the height to the watch.
  const linkOnTop = wide && toggleExpanded !== undefined

  async function finish(event: PlanEvent) {
    const at = Date.now()
    const record = finishRecord(elapsed, watch.began ?? at - elapsed, at)
    const minutes = record.actual
    setBusy(true)
    setError('')
    try {
      await onChange({ type: 'session.finish', uid: event.uid, ...record })
      watch.reset()
      glass.reset()
      pick(undefined)
      setLogged({ title: event.title, minutes })
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  const start = (uid: string) => {
    glass.resume()
    watch.start(uid)
  }
  const reset = () => {
    watch.reset()
    glass.reset()
  }

  const when = (e: PlanEvent) => {
    const s = parseLocal(e.start)
    return `${today !== null && startOfDay(s) === today ? m.today() : fmtDay(s)}, ${hm(s)}–${hm(parseLocal(e.end))}`
  }

  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)] gap-4 px-3 md:px-5 ${wide ? 'pt-3 pb-4' : 'mx-auto max-w-[1240px] pt-3.5 pb-10 md:pt-5 md:pb-12'}`}
    >
      {!wide && (
        <PageHeader
          aside={headerAside}
          actions={
            <>
              <IconsToggle label={m.icons_only()} hint={m.icons_only_hint()} className="max-md:flex-none!" />
              <HelpToggle label={m.help_toggle()} className="max-md:flex-none!" />
            </>
          }
        >
          <h1 className="flex items-center gap-2 text-[22px]/[1.2] font-semibold tracking-[-0.01em]">
            {m.focus()}
            <Hint title={m.help_focus_title()} text={m.help_focus()} />
          </h1>
          <p className="mt-1 text-[14px] text-muted">{m.focus_hint()}</p>
        </PageHeader>
      )}

      <div ref={columns} className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_340px]">
        <section
          className={`flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface px-5 ${wide ? 'pb-6' : 'pb-10 md:pb-14'} ${toggleExpanded ? 'pt-3' : 'pt-10 md:pt-14'}`}
          // The card is the screen's height, so the watch can take what is left of it; it grows if it must.
          style={{
            ...calendarColor(color),
            ...(wide && fill !== undefined && { height: fill, minHeight: 'min-content' }),
          }}
        >
          {toggleExpanded && (
            <div
              className={`flex flex-wrap items-center gap-2 ${linkOnTop && courseUrl ? 'justify-between' : 'justify-end'}`}
            >
              {linkOnTop && courseLink}
              <div className="flex flex-wrap justify-end gap-2">
                <ScreenButtons
                  expanded={expanded}
                  expandHint={m.focus_expand_hint()}
                  onToggleExpanded={toggleExpanded}
                  fullscreen={fullscreen.supported ? fullscreen : undefined}
                  className="py-1! text-[13px]"
                />
              </div>
            </div>
          )}
          <div
            className={
              wide
                ? 'flex min-h-0 flex-1 flex-col items-center gap-4 text-center'
                : 'grid flex-1 content-center justify-items-center gap-5 text-center'
            }
          >
            {session ? (
              <>
                <div className="min-w-0">
                  <h2 className="flex items-baseline justify-center gap-2.5 text-[19px]/[1.35] font-semibold">
                    <Dot className="size-2.5 flex-none -translate-y-px" />
                    <span className="min-w-0">{session.title}</span>
                  </h2>
                  <p className="mt-1.5 text-[13.5px] text-muted tabular-nums">
                    {when(session)} · {m.focus_planned({ time: fmtDuration(planned) })}
                  </p>
                </div>

                <div
                  className={`flex min-w-0 flex-col items-center gap-x-12 gap-y-5 md:flex-row md:justify-center ${
                    wide
                      ? `${WIDE_ROW} ${settings.hidden ? BESIDE.alone : BESIDE.glass} ${elapsed >= HOUR ? DIGITS_EM.hours : DIGITS_EM.minutes}`
                      : ''
                  }`}
                >
                  {showGlass ? (
                    <Hourglass
                      run={block.run}
                      at={glass.now}
                      length={block.length}
                      running={glass.moving}
                      tone={block.kind}
                      color={color}
                      still={settings.still}
                      turn={block.key}
                      className={`flex-none ${wide ? WIDE_GLASS_BOX : GLASS_BOX}`}
                    />
                  ) : (
                    !settings.hidden && <div className={`flex-none ${wide ? WIDE_GLASS_BOX : GLASS_BOX}`} />
                  )}
                  <div className="min-w-0">
                    <p
                      role="timer"
                      aria-label={m.focus_elapsed()}
                      className={`font-display font-semibold tracking-[-0.02em] tabular-nums ${wide ? WIDE_DIGITS : DIGITS}`}
                    >
                      {stopwatchText(elapsed)}
                    </p>
                    {/* With the session in the glass, a bar would say the same again. */}
                    {(settings.hidden || rhythm) && (
                      <div className="mx-auto mt-5 h-1.5 w-full max-w-[420px] min-w-[min(240px,70vw)] overflow-hidden rounded bg-line-soft">
                        <i
                          className={`block h-full rounded ${elapsed > planned ? 'bg-today' : 'bg-cal'}`}
                          style={{ width: `${Math.min(100, (elapsed / planned) * 100)}%` }}
                        />
                      </div>
                    )}
                    <p className="mt-2.5 text-[13px] text-muted tabular-nums">
                      {elapsed > planned
                        ? m.focus_over({ time: fmtDuration(elapsed - planned) })
                        : m.focus_left({ time: fmtDuration(planned - elapsed) })}
                    </p>
                    {rhythm && block.kind === 'work' && !glass.due && (
                      <p className="mt-0.5 text-[13px] text-muted tabular-nums">
                        {m.focus_break_in({ minutes: minutesLeft })}
                      </p>
                    )}
                    <p className="mt-1 text-[14px] font-medium" role="status">
                      {glass.due && rhythm && m.focus_break_due({ time: fmtDuration(rhythm.rest) })}
                      {glass.rested && m.focus_break_over()}
                      {glass.out && watch.timed === session.uid && m.focus_glass_out()}
                    </p>
                  </div>
                </div>

                {(glass.due || glass.resting) && (
                  <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-surface-2 p-2">
                    {glass.due ? (
                      <>
                        <Button
                          primary
                          className="flex items-center gap-1.5"
                          icon={<Coffee size={16} aria-hidden />}
                          label={m.focus_break_take()}
                          onClick={() => {
                            watch.pause()
                            glass.take()
                          }}
                        />
                        <Button onClick={glass.skip}>{m.focus_break_skip()}</Button>
                      </>
                    ) : (
                      <>
                        <span
                          role="timer"
                          className="flex items-center gap-1.5 px-2 text-[14px] font-medium tabular-nums"
                        >
                          <Coffee size={16} aria-hidden />{' '}
                          {m.focus_break_left({ time: stopwatchText(block.length - block.run) })}
                        </span>
                        <Button onClick={() => start(session.uid)}>{m.focus_break_end()}</Button>
                      </>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-2">
                  {running ? (
                    <Button
                      className="flex items-center gap-1.5"
                      icon={<Pause size={16} aria-hidden />}
                      label={m.focus_pause()}
                      onClick={watch.pause}
                    />
                  ) : (
                    <Button
                      primary
                      className="flex items-center gap-1.5"
                      icon={<Play size={16} aria-hidden />}
                      label={elapsed ? m.focus_resume() : m.focus_start()}
                      onClick={() => start(session.uid)}
                    />
                  )}
                  {canEdit && (
                    <Button
                      className="flex items-center gap-1.5 border-done text-done-ink"
                      disabled={busy || !elapsed}
                      icon={<Check size={16} aria-hidden />}
                      label={m.focus_finish({ time: fmtDuration(loggedMinutes(elapsed) * MINUTE) })}
                      onClick={() => void finish(session)}
                    />
                  )}
                  <Button
                    className="grid place-items-center px-2.5"
                    aria-label={m.focus_reset()}
                    data-tip={m.focus_reset()}
                    disabled={!elapsed}
                    onClick={reset}
                  >
                    <RotateCcw size={16} aria-hidden />
                  </Button>
                </div>
                {!linkOnTop && courseLink}
                <GlassControls
                  compact={wide}
                  settings={settings}
                  onChoose={glass.choose}
                  onMinutes={glass.setMinutes}
                  onToggleStill={glass.toggleStill}
                  onToggleHidden={glass.toggleHidden}
                />
              </>
            ) : (
              <p className="text-[15px] text-muted">{m.focus_empty()}</p>
            )}
            {error && (
              <p className="text-[13px] text-today-ink" role="alert">
                {error}
              </p>
            )}
            <p className="min-h-5 text-[13px] text-done-ink" role="status">
              {logged && m.focus_logged({ title: logged.title, time: fmtDuration(logged.minutes * MINUTE) })}
            </p>
          </div>
        </section>

        <aside
          className="min-w-0 overflow-y-auto rounded-2xl border border-line bg-surface p-4"
          style={fill === undefined ? undefined : { maxHeight: fill }}
        >
          <h2 className="text-[12px] font-semibold tracking-wide text-muted uppercase">{m.focus_queue()}</h2>
          <ul className="mt-2 grid gap-1">
            {listed.map((e) => (
              <li key={e.uid} style={calendarColor(plan.calendars.find((c) => c.id === e.calendar)?.color)}>
                <button
                  type="button"
                  className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-surface-2 aria-pressed:bg-surface-2"
                  aria-pressed={e.uid === session?.uid}
                  // A running stopwatch belongs to its session: pause or finish it before taking another.
                  disabled={watch.running && e.uid !== session?.uid}
                  onClick={() => pick(e.uid)}
                >
                  <b className="flex items-baseline gap-2 text-[13.5px]/[1.35] font-semibold">
                    <Dot className="size-2 flex-none -translate-y-px" />
                    <span className="min-w-0">{e.title}</span>
                  </b>
                  <span className="block pl-4 text-[12.5px] text-muted tabular-nums">{when(e)}</span>
                </button>
              </li>
            ))}
          </ul>
          {!queue.length && <p className="mt-2 text-[13.5px] text-muted">{m.focus_empty()}</p>}
        </aside>
      </div>
    </div>
  )
}
