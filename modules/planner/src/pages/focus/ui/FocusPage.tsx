import { fmtDay, fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, isSession, parseLocal, startOfDay, type Plan, type PlanChange, type PlanEvent } from '@lc/plan-domain'
import { Button, calendarColor, Check, Dot, ExternalLink, PageHeader, Pause, Play, RotateCcw } from '@lc/ui'
import { useState, type ReactNode } from 'react'

import { useNow } from '../../../shared/lib'
import { useStopwatch } from '../model/use-stopwatch'

interface Props {
  plan: Plan
  /** false on a read-only host: the time can be measured but not logged */
  canEdit: boolean
  /** uid of the session to time, as the host keeps it (in the URL); without it the page picks by the clock */
  session?: string
  /** Called with the uid picked from the queue, or with undefined once it is finished: the host stores it */
  onPick?: (uid: string | undefined) => void
  /** Stores one change. Rejects with the reason when it cannot be stored: the page shows it */
  onChange: (change: PlanChange) => Promise<void>
  /** Shown next to the title: controls the host owns, such as the sections of the app */
  headerAside?: ReactNode
  /** Minsk wall-clock ms to take as the present, for a fixed picture in a story; the real clock otherwise */
  now?: number
}

const MINUTE = 60_000
const QUARTER = 15 * MINUTE
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
/** What gets logged: quarter-hour steps, like the time field of a session, and never nothing. */
const loggedMinutes = (ms: number) => Math.max(QUARTER, Math.round(ms / QUARTER) * QUARTER) / MINUTE

/**
 * One session and a stopwatch. Start it when you sit down; `Finish` marks the session done and logs the time it
 * really took, which is what the pace forecast is worked out from. The session is the one in progress, or the next
 * one that is not done; any other from the queue can be picked.
 */
export function FocusPage({ plan, canEdit, session: wanted, onPick, onChange, headerAside, now: fixed }: Props) {
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
  const elapsed = session && watch.timed === session.uid ? watch.elapsed : 0
  const running = watch.running && watch.timed === session?.uid
  const color = plan.calendars.find((c) => c.id === session?.calendar)?.color
  const courseUrl = session?.description.match(URL_PATTERN)?.[0]

  async function finish(event: PlanEvent) {
    const minutes = loggedMinutes(elapsed)
    setBusy(true)
    setError('')
    try {
      await onChange({ type: 'event.patch', uid: event.uid, patch: { done: true, actual: minutes } })
      watch.reset()
      pick(undefined)
      setLogged({ title: event.title, minutes })
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  const when = (e: PlanEvent) => {
    const s = parseLocal(e.start)
    return `${today !== null && startOfDay(s) === today ? m.today() : fmtDay(s)}, ${hm(s)}–${hm(parseLocal(e.end))}`
  }

  return (
    <div className="mx-auto grid max-w-[1240px] gap-4 px-3 pt-3.5 pb-10 md:px-5 md:pt-5 md:pb-12">
      <PageHeader aside={headerAside}>
        <h1 className="text-[22px]/[1.2] font-semibold tracking-[-0.01em]">{m.focus()}</h1>
        <p className="mt-1 text-[14px] text-muted">{m.focus_hint()}</p>
      </PageHeader>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_340px]">
        <section
          className="grid min-w-0 justify-items-center gap-5 rounded-2xl border border-line bg-surface px-5 py-10 text-center md:py-14"
          style={calendarColor(color)}
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

              <div>
                <p
                  role="timer"
                  aria-label={m.focus_elapsed()}
                  className="font-display text-[72px]/[1] font-semibold tracking-[-0.02em] tabular-nums md:text-[104px]/[1]"
                >
                  {stopwatchText(elapsed)}
                </p>
                <div className="mx-auto mt-5 h-1.5 w-[min(420px,70vw)] overflow-hidden rounded bg-line-soft">
                  <i
                    className={`block h-full rounded ${elapsed > planned ? 'bg-today' : 'bg-cal'}`}
                    style={{ width: `${Math.min(100, (elapsed / planned) * 100)}%` }}
                  />
                </div>
                <p className="mt-2.5 text-[13px] text-muted tabular-nums">
                  {elapsed > planned
                    ? m.focus_over({ time: fmtDuration(elapsed - planned) })
                    : m.focus_left({ time: fmtDuration(planned - elapsed) })}
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {running ? (
                  <Button className="flex items-center gap-1.5" onClick={watch.pause}>
                    <Pause size={16} aria-hidden /> {m.focus_pause()}
                  </Button>
                ) : (
                  <Button primary className="flex items-center gap-1.5" onClick={() => watch.start(session.uid)}>
                    <Play size={16} aria-hidden /> {elapsed ? m.focus_resume() : m.focus_start()}
                  </Button>
                )}
                {canEdit && (
                  <Button
                    className="flex items-center gap-1.5 border-done text-done-ink"
                    disabled={busy || !elapsed}
                    onClick={() => void finish(session)}
                  >
                    <Check size={16} aria-hidden />
                    {m.focus_finish({ time: fmtDuration(loggedMinutes(elapsed) * MINUTE) })}
                  </Button>
                )}
                <Button
                  className="grid place-items-center px-2.5"
                  aria-label={m.focus_reset()}
                  title={m.focus_reset()}
                  disabled={!elapsed}
                  onClick={watch.reset}
                >
                  <RotateCcw size={16} aria-hidden />
                </Button>
              </div>
              {courseUrl && (
                <a
                  className="flex items-center gap-1.5 text-[13.5px] text-focus hover:underline"
                  href={courseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {m.open_course()} <ExternalLink size={14} aria-hidden />
                </a>
              )}
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
        </section>

        <aside className="min-w-0 rounded-2xl border border-line bg-surface p-4">
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
