import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, startOfDay, type CalendarLane, type LaneSessionState } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'
import type { CSSProperties } from 'react'

import { dayMs, type Scale } from '../lib/scale'
import type { LaneEditing } from '../model/editing'
import { BAND, span } from './lane-parts'
import { DeadlineHandle, FinishHandle, LaneBody } from './LaneHandles'

interface Props {
  lane: CalendarLane
  scale: Scale
  /** Minsk wall-clock ms; null before the clock is known */
  now: number | null
  /** Draws the first lane without the gap a phone puts above the others */
  first: boolean
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

/** One calendar on the timeline: its name, and a track with its sessions, its spare or late days and its deadline. */
export function LaneRow({ lane, scale, now, first, edit, keysHint }: Props) {
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

  return (
    <>
      <div className={`flex min-w-0 items-center gap-2 text-[13px] ${first ? '' : 'max-md:mt-2'}`} style={color}>
        <Dot className="size-2.5" />
        <span className="truncate font-medium" title={calendar.name}>
          {calendar.name}
        </span>
        <span className="ml-auto flex-none text-[12px] text-muted tabular-nums">
          {lane.done}/{lane.total}
        </span>
      </div>
      <div data-track className="relative h-9 md:h-6" style={color}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            data-bar
            data-cut={cut}
            className={`${BAND} rounded-full bg-[color-mix(in_srgb,var(--c)_24%,var(--surface))]`}
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
              className={`absolute top-1/2 size-1.5 -translate-1/2 rounded-full ${MARK[session.state]}`}
              style={{ left: `${scale.at(dayMs(session.day) + DAY / 2)}%` }}
            />
          ))}
        </div>
        {handles && edit && (
          <LaneBody
            {...handles}
            moving={moving}
            onOpen={() => edit.onOpen(calendar.id)}
            onMove={onMove && ((days) => onMove(calendar.id, days))}
          />
        )}
        {handles && onFinish && moving.length > 0 && (
          <FinishHandle {...handles} describedBy={keysHint} onFinish={(day) => onFinish(calendar.id, day)} />
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
                className="absolute top-1/2 size-2.5 -translate-1/2 rotate-45 rounded-[2px] bg-ink ring-2 ring-surface"
                style={{ left: `${scale.at(deadline)}%` }}
              />
            )
          ))}
        {todayAt !== null && todayAt >= 0 && todayAt <= 100 && (
          <i
            data-today
            aria-hidden
            className="pointer-events-none absolute -inset-y-0.5 -ml-px w-0.5 bg-today"
            style={{ left: `${todayAt}%` }}
          />
        )}
      </div>
    </>
  )
}
