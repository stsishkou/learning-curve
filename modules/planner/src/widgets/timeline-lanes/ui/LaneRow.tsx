import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, type CalendarLane, type LaneSessionState } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'
import type { CSSProperties } from 'react'

import { clampPct, dayMs, type Scale } from '../lib/scale'

interface Props {
  lane: CalendarLane
  scale: Scale
  /** Minsk wall-clock ms; null before the clock is known */
  now: number | null
  /** Draws the first lane without the gap a phone puts above the others */
  first: boolean
}

const MARK: Record<LaneSessionState, string> = {
  done: 'bg-cal',
  open: 'bg-[color-mix(in_srgb,var(--c)_55%,var(--surface))]',
  missed: 'bg-surface ring-[1.5px] ring-today',
}
const BAND = 'absolute top-1/2 h-2 -translate-y-1/2'
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

/** Left edge and width of the days from `a` to `b` on the track, clamped to it. */
function span(scale: Scale, a: number, b: number): CSSProperties {
  const left = clampPct(scale.at(a))
  return { left: `${left}%`, width: `${Math.max(0, clampPct(scale.at(b)) - left)}%` }
}

/** One calendar on the timeline: its name, and a track with its sessions, its spare or late days and its deadline. */
export function LaneRow({ lane, scale, now, first }: Props) {
  const { calendar } = lane
  const color = calendarColor(calendar.color)
  const start = dayMs(lane.first)
  const end = dayMs(lane.last) + DAY
  const deadline = lane.deadline === null ? null : dayMs(lane.deadline)
  const from = scale.at(start)
  const to = scale.at(end)
  const cut: Cut | undefined = from < 0 ? (to > 100 ? 'both' : 'start') : to > 100 ? 'end' : undefined
  const today = now === null ? null : scale.at(now)

  return (
    <>
      <div className={`flex min-w-0 items-center gap-2 text-[13px] ${first ? '' : 'max-md:mt-2'}`} style={color}>
        <Dot className="size-2.5" />
        <span className="truncate font-medium">{calendar.name}</span>
        <span className="ml-auto flex-none text-[12px] text-muted tabular-nums">
          {lane.done}/{lane.total}
        </span>
      </div>
      <div className="relative h-9 md:h-6" style={color}>
        <div className="absolute inset-0 overflow-hidden">
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
        {deadline !== null && (
          <span
            data-deadline
            role="img"
            aria-label={m.deadline_on({ date: fmtDay(deadline) })}
            title={m.deadline_on({ date: fmtDay(deadline) })}
            className="absolute top-1/2 size-2.5 -translate-1/2 rotate-45 rounded-[2px] bg-ink ring-2 ring-surface"
            style={{ left: `${scale.at(deadline)}%` }}
          />
        )}
        {today !== null && today >= 0 && today <= 100 && (
          <i
            data-today
            aria-hidden
            className="absolute -inset-y-0.5 -ml-px w-0.5 bg-today"
            style={{ left: `${today}%` }}
          />
        )}
      </div>
    </>
  )
}
