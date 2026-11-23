import { fmtDay, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, laneSpare, startOfDay, type CalendarLane, type LaneChange, type LaneSessionState } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'
import type { CSSProperties } from 'react'

import { clampPct, dayMs, type Scale, type Ticks } from '../lib/scale'
import type { LaneEditing } from '../model/editing'
import { BAND, signed, spareText, span } from './lane-parts'
import { DeadlineHandle, FinishHandle, LaneBody } from './LaneHandles'

interface Props {
  /** The course as it is, or as the draft would leave it */
  lane: CalendarLane
  /** How the draft changes it: the course as it was is drawn under it */
  change?: LaneChange | undefined
  showBefore: boolean
  /** Sessions the draft gives another time */
  moved: ReadonlySet<string>
  scale: Scale
  ticks: Ticks
  /** Lines at each Monday, where weeks are wide enough to tell apart */
  weekLines: boolean
  /** Minsk wall-clock ms; null before the clock is known */
  now: number | null
  selected: boolean
  /** A re-balance of the course is being worked out */
  working: boolean
  /** Without it the lane only shows; it also waits for the clock, which says what "from today on" is */
  edit?: LaneEditing | undefined
  /** Id of the text that tells the slider keys */
  keysHint: string
}

const MARK: Record<LaneSessionState, string> = {
  done: 'bg-cal',
  open: 'bg-[color-mix(in_srgb,var(--c)_55%,var(--surface))]',
  missed: 'bg-surface ring-[1.5px] ring-today',
}
const FADE = 24
const DIAMOND = 'absolute top-1/2 size-2.5 -translate-1/2 rotate-45 rounded-[2px]'

type Cut = 'start' | 'end' | 'both'

/** A bar cut by an edge of the drawn days fades out there instead of ending as if the course did. */
function fadeOf(cut: Cut | undefined): CSSProperties {
  if (cut === 'start') return { maskImage: `linear-gradient(to right, transparent, black ${FADE}px)` }
  if (cut === 'end') return { maskImage: `linear-gradient(to left, transparent, black ${FADE}px)` }
  if (cut === 'both') {
    return {
      maskImage: `linear-gradient(to right, transparent, black ${FADE}px, black calc(100% - ${FADE}px), transparent)`,
    }
  }
  return {}
}

/** The days a change moves the course by, at the place it shows best: its end, its start, or its deadline. */
function deltaOf(change: LaneChange): { days: number; at: number } | null {
  const { before, after } = change
  if (change.endDays) return { days: change.endDays, at: dayMs(after.last) + DAY }
  if (change.startDays) return { days: change.startDays, at: dayMs(after.first) }
  if (before.deadline !== null && after.deadline !== null && before.deadline !== after.deadline) {
    return { days: Math.round((dayMs(after.deadline) - dayMs(before.deadline)) / DAY), at: dayMs(after.deadline) }
  }
  return null
}

/** One course on the timeline: its name and dates, and a track with its sessions, spare or late days and deadline. */
export function LaneRow(props: Props) {
  const { lane, change, showBefore, moved, scale, ticks, weekLines, now, selected, working, edit, keysHint } = props
  const { calendar } = lane
  const color = calendarColor(calendar.color)
  const start = dayMs(lane.first)
  const end = dayMs(lane.last) + DAY
  const deadline = lane.deadline === null ? null : dayMs(lane.deadline)
  const from = scale.at(start)
  const to = scale.at(end)
  const cut: Cut | undefined = from < 0 ? (to > 100 ? 'both' : 'start') : to > 100 ? 'end' : undefined
  const today = now === null ? null : startOfDay(now)
  const todayAt = now === null ? null : scale.at(now)
  // The sessions a move takes along: the ones not done, from today on, as `events.shift` picks them.
  const moving = today === null ? [] : lane.sessions.filter((s) => s.state !== 'done' && dayMs(s.day) >= today)
  const handles = edit && today !== null ? { lane, scale, today } : null
  const { onFinish, onDeadline, onMove } = edit ?? {}
  const spare = laneSpare(lane)
  const before = change && showBefore ? change.before : null
  const oldDeadline = before?.deadline !== lane.deadline && before?.deadline ? dayMs(before.deadline) : null
  const delta = change ? deltaOf(change) : null

  return (
    <>
      <div
        className={`sticky left-0 z-20 flex min-w-0 flex-col justify-center gap-0.5 border-b border-line-soft px-3 py-1.5 md:px-4 ${selected ? 'bg-surface-2' : 'bg-surface'}`}
        style={color}
      >
        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          <Dot className="size-2.5" />
          <span className="truncate font-medium" title={calendar.name}>
            {calendar.name}
          </span>
          {change && (
            <span className="size-1.5 flex-none rounded-full bg-focus" title={m.timeline_changed()}>
              <span className="sr-only">{m.timeline_changed()}</span>
            </span>
          )}
          <span className="ml-auto flex-none text-[12px] text-muted tabular-nums">
            {lane.done}/{lane.total}
          </span>
        </div>
        <div className="truncate text-[11.5px] text-muted tabular-nums">
          {m.timeline_dates({ from: fmtShort(start), to: fmtShort(end - DAY) })}
          {spare !== null && (
            <>
              {' · '}
              <span className={spare < 0 ? 'font-medium text-today-ink' : ''}>{spareText(spare)}</span>
            </>
          )}
        </div>
      </div>
      <div
        data-track
        aria-busy={working}
        className={`group/track relative h-12 border-b border-line-soft ${selected ? 'bg-[color-mix(in_srgb,var(--c)_7%,transparent)]' : ''}`}
        style={color}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {weekLines &&
            ticks.mondays.map((t) => (
              <i key={t} className="absolute inset-y-0 w-px bg-line-soft" style={{ left: `${scale.at(t)}%` }} />
            ))}
          {ticks.months.map((t) => (
            <i key={t} className="absolute inset-y-0 w-px bg-line" style={{ left: `${scale.at(t)}%` }} />
          ))}
          {before && (
            <div
              data-before
              className="absolute top-[calc(50%+10px)] h-0 border-t-2 border-dashed border-cal opacity-70"
              style={span(scale, dayMs(before.first), dayMs(before.last) + DAY)}
            />
          )}
          {oldDeadline !== null && (
            <i
              data-before-deadline
              className={`${DIAMOND} border-[1.5px] border-ink opacity-45`}
              style={{ left: `${scale.at(oldDeadline)}%` }}
            />
          )}
          {/* Fades while the course is dragged: the ghost shows where it would go. */}
          <div data-course className="absolute inset-0 group-has-[[data-ghost]]/track:opacity-40">
            <div
              data-bar
              data-cut={cut}
              className={`${BAND} rounded-full bg-[color-mix(in_srgb,var(--c)_24%,var(--surface))] ${working ? 'motion-safe:animate-pulse' : ''}`}
              style={{ ...span(scale, start, end), ...fadeOf(cut) }}
            />
            {deadline !== null && deadline > end && (
              <div
                className={`${BAND} bg-[repeating-linear-gradient(135deg,transparent_0_4px,var(--line)_4px_6px)]`}
                style={span(scale, end, deadline)}
              />
            )}
            {deadline !== null && deadline < end && (
              <div
                className={`${BAND} bg-[color-mix(in_srgb,var(--today)_40%,transparent)]`}
                style={span(scale, Math.max(deadline, start), end)}
              />
            )}
            {lane.sessions.map((session) => (
              <i
                key={session.uid}
                data-state={session.state}
                data-moved={moved.has(session.uid) || undefined}
                className={`absolute top-1/2 size-2 -translate-1/2 rounded-full ${MARK[session.state]} ${moved.has(session.uid) ? 'outline-[1.5px] outline-offset-1 outline-focus outline-solid' : ''}`}
                style={{ left: `${scale.at(dayMs(session.day) + DAY / 2)}%` }}
              />
            ))}
          </div>
        </div>
        {delta && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0.5 z-10 ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--focus)_14%,var(--surface))] px-1.5 text-[11px]/[16px] font-semibold whitespace-nowrap text-focus tabular-nums"
            style={{ left: `${Math.min(92, clampPct(scale.at(delta.at)))}%` }}
          >
            {m.timeline_delta_days({ days: signed(delta.days) })}
          </span>
        )}
        {handles && edit && (
          <LaneBody
            {...handles}
            moving={moving}
            selected={selected}
            onSelect={() => edit.onSelect(calendar.id)}
            onMove={onMove && ((days) => onMove(calendar.id, days))}
          />
        )}
        {handles && onFinish && moving.length > 0 && (
          <FinishHandle
            {...handles}
            describedBy={keysHint}
            moving={moving.length}
            onFinish={(day) => onFinish(calendar.id, day)}
          />
        )}
        {lane.deadline !== null &&
          (handles && onDeadline ? (
            <DeadlineHandle
              {...handles}
              describedBy={keysHint}
              deadline={lane.deadline}
              onDeadline={(day) => onDeadline(calendar.id, day)}
            />
          ) : (
            deadline !== null && (
              <span
                data-deadline
                role="img"
                aria-label={m.deadline_on({ date: fmtDay(deadline) })}
                title={m.deadline_on({ date: fmtDay(deadline) })}
                className={`${DIAMOND} bg-ink ring-2 ring-surface`}
                style={{ left: `${scale.at(deadline)}%` }}
              />
            )
          ))}
        {todayAt !== null && todayAt >= 0 && todayAt <= 100 && (
          <i
            data-today
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -ml-px w-0.5 bg-today"
            style={{ left: `${todayAt}%` }}
          />
        )}
      </div>
    </>
  )
}
