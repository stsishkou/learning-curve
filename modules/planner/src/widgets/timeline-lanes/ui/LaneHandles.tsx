import { fmtDay, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { addDays, DAY, type CalendarLane, type LaneSession } from '@lc/plan-domain'
import type { ReactNode } from 'react'

import { clampPct, dayMs, type Scale } from '../lib/scale'
import { useNudge } from '../model/use-nudge'
import { BAND, signed, spareDays, spareText, span } from './lane-parts'

interface Common {
  lane: CalendarLane
  scale: Scale
  /** Day ms of today */
  today: number
}

interface SliderProps extends Common {
  /** Id of the text that tells the keys */
  describedBy: string
}

// Half a year: a course moved further than that is a new plan, made in the dialog.
const MAX_MOVE = 182
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus'
const HANDLE = `absolute inset-y-0 w-6 cursor-ew-resize rounded-md touch-none ${FOCUS}`

/** The result of a drag in words, over the place it points at. */
function Tip({ at, children }: { at: number; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-full z-30 mb-1 -translate-x-1/2 rounded-md bg-ink px-1.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap text-surface"
      style={{ left: `${Math.max(8, Math.min(92, at))}%` }}
    >
      {children}
    </span>
  )
}

const valueOf = (scale: Scale, t: number) => Math.round((t - scale.start) / DAY)

/**
 * The bar of a course: a click selects it; a drag moves its sessions from today on by whole weeks, so each keeps its
 * weekday.
 */
export function LaneBody({
  lane,
  scale,
  today,
  moving,
  selected,
  onSelect,
  onMove,
}: Common & {
  moving: LaneSession[]
  selected: boolean
  onSelect: () => void
  onMove?: ((days: number) => void) | undefined
}) {
  const [head] = moving
  const firstMoved = head ? dayMs(head.day) : null
  const canMove = onMove !== undefined && firstMoved !== null
  const nudge = useNudge({
    days: scale.days,
    step: 7,
    // Nothing moves into the past: the first session moved stays on or after today.
    min: firstMoved === null ? 0 : -Math.floor((firstMoved - today) / DAY / 7) * 7,
    max: canMove ? MAX_MOVE : 0,
    onCommit: (days) => onMove?.(days),
  })
  const start = dayMs(lane.first)
  const end = dayMs(lane.last) + DAY
  const shift = nudge.offset * DAY
  const left = clampPct(scale.at(start))
  const late = lane.deadline === null ? 0 : spareDays(end - DAY + shift, dayMs(lane.deadline))
  return (
    <>
      <button
        type="button"
        aria-label={m.timeline_lane({
          name: lane.calendar.name,
          from: fmtDay(start),
          to: fmtDay(end - DAY),
          done: lane.done,
          total: lane.total,
        })}
        aria-pressed={selected}
        className={`absolute inset-y-1 rounded-md ${FOCUS} ${canMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        style={{ left: `${left}%`, width: `${clampPct(scale.at(end)) - left}%` }}
        onClick={() => {
          if (!nudge.afterDrop()) onSelect()
        }}
        onPointerDown={canMove ? nudge.onPointerDown : undefined}
        onPointerMove={nudge.onPointerMove}
        onPointerUp={nudge.onPointerUp}
        onPointerCancel={nudge.onPointerCancel}
      />
      {shift !== 0 && firstMoved !== null && (
        <>
          <div data-ghost aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className={`${BAND} rounded-full border border-dashed border-cal bg-[color-mix(in_srgb,var(--c)_30%,transparent)]`}
              style={span(scale, firstMoved + shift, end + shift)}
            />
            {moving.map((session) => (
              <i
                key={session.uid}
                className="absolute top-1/2 size-1.5 -translate-1/2 rounded-full bg-cal"
                style={{ left: `${scale.at(dayMs(session.day) + DAY / 2 + shift)}%` }}
              />
            ))}
          </div>
          <Tip at={scale.at(firstMoved + shift)}>
            {m.timeline_shift_weeks({ weeks: signed(nudge.offset / 7) })} ·{' '}
            {m.timeline_sessions({ count: moving.length })} ·{' '}
            {m.timeline_dates({ from: fmtShort(firstMoved + shift), to: fmtShort(end - DAY + shift) })}
            {late < 0 && ` · ${spareText(late)}`}
          </Tip>
        </>
      )}
    </>
  )
}

/** The end of a course, moved by days to ask for a re-balance that finishes by the day it points at. */
export function FinishHandle({
  lane,
  scale,
  today,
  describedBy,
  moving,
  onFinish,
}: SliderProps & { moving: number; onFinish: (day: string) => void }) {
  const last = dayMs(lane.last)
  const earliest = Math.max(today, lane.openFrom === null ? today : dayMs(lane.openFrom))
  const nudge = useNudge({
    days: scale.days,
    step: 1,
    min: Math.round((earliest - last) / DAY),
    max: Math.round((scale.end - DAY - last) / DAY),
    onCommit: (days) => onFinish(addDays(lane.last, days)),
  })
  const day = last + nudge.offset * DAY
  const at = scale.at(day + DAY)
  return (
    <>
      <span
        role="slider"
        tabIndex={0}
        aria-label={m.timeline_finish({ name: lane.calendar.name })}
        aria-valuemin={valueOf(scale, earliest)}
        aria-valuemax={valueOf(scale, scale.end - DAY)}
        aria-valuenow={valueOf(scale, day)}
        aria-valuetext={fmtDay(day)}
        aria-describedby={describedBy}
        className={`${HANDLE} z-10 -ml-6 flex items-center justify-end`}
        style={{ left: `${clampPct(at)}%` }}
        onPointerDown={nudge.onPointerDown}
        onPointerMove={nudge.onPointerMove}
        onPointerUp={nudge.onPointerUp}
        onPointerCancel={nudge.onPointerCancel}
        onKeyDown={nudge.onKeyDown}
        onBlur={nudge.onBlur}
      >
        <i className="-mr-0.5 h-3.5 w-1 rounded-full bg-cal" />
      </span>
      {nudge.offset !== 0 && (
        <>
          <i
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -ml-px w-0.5 bg-cal"
            style={{ left: `${clampPct(at)}%` }}
          />
          <Tip at={at}>
            {m.timeline_finish_by({ day: fmtShort(day) })} · {m.timeline_sessions({ count: moving })}
          </Tip>
        </>
      )}
    </>
  )
}

/** The deadline of a course, moved by days. */
export function DeadlineHandle({
  lane,
  scale,
  today,
  describedBy,
  deadline: day0,
  onDeadline,
}: SliderProps & { deadline: string; onDeadline: (day: string) => void }) {
  const deadline = dayMs(day0)
  const nudge = useNudge({
    days: scale.days,
    step: 1,
    min: Math.round((today - deadline) / DAY),
    max: Math.round((scale.end - DAY - deadline) / DAY),
    onCommit: (days) => onDeadline(addDays(day0, days)),
  })
  const day = deadline + nudge.offset * DAY
  return (
    <>
      {nudge.offset !== 0 && (
        <i
          aria-hidden
          className="pointer-events-none absolute top-1/2 size-2.5 -translate-1/2 rotate-45 rounded-[2px] bg-ink opacity-30"
          style={{ left: `${scale.at(deadline)}%` }}
        />
      )}
      <span
        role="slider"
        tabIndex={0}
        aria-label={m.timeline_deadline({ name: lane.calendar.name })}
        aria-valuemin={valueOf(scale, Math.min(today, deadline))}
        aria-valuemax={valueOf(scale, scale.end - DAY)}
        aria-valuenow={valueOf(scale, day)}
        aria-valuetext={fmtDay(day)}
        aria-describedby={describedBy}
        title={m.deadline_on({ date: fmtDay(day) })}
        className={`${HANDLE} z-20 -ml-3 grid place-items-center`}
        style={{ left: `${clampPct(scale.at(day))}%` }}
        onPointerDown={nudge.onPointerDown}
        onPointerMove={nudge.onPointerMove}
        onPointerUp={nudge.onPointerUp}
        onPointerCancel={nudge.onPointerCancel}
        onKeyDown={nudge.onKeyDown}
        onBlur={nudge.onBlur}
      >
        <i data-deadline className="size-2.5 rotate-45 rounded-[2px] bg-ink ring-2 ring-surface" />
      </span>
      {nudge.offset !== 0 && (
        <Tip at={scale.at(day)}>
          {m.deadline_on({ date: fmtShort(day) })} · {spareText(spareDays(dayMs(lane.last), day))}
        </Tip>
      )}
    </>
  )
}
