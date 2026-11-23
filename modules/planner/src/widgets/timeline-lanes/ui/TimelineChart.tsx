import { m } from '@lc/i18n/messages'
import { DAY, type CalendarLane, type LaneChange } from '@lc/plan-domain'
import { Button, Segmented } from '@lc/ui'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { scaleOf, ticksOf } from '../lib/scale'
import type { LaneEditing } from '../model/editing'
import { PX_PER_DAY, useZoom, type TimelineZoom } from '../model/use-zoom'
import { LaneRow } from './LaneRow'
import { TimelineAxis } from './TimelineAxis'
import { TimelineLegend } from './TimelineLegend'

declare module 'react' {
  interface CSSProperties {
    '--track'?: string | undefined
  }
}

interface Props {
  /** The courses as they are, or as the draft would leave them */
  lanes: CalendarLane[]
  /** Courses the draft changes, by calendar id: each is drawn over the course as it was */
  changes?: ReadonlyMap<string, LaneChange> | undefined
  /** Sessions the draft gives another time */
  moved?: ReadonlySet<string> | undefined
  /** Day ms drawn, `end` excluded: `lanesRange` over the lanes before and after the draft */
  range: { start: number; end: number }
  /** Minsk wall-clock ms; null before the clock is known, as on the server */
  now: number | null
  selected?: string | null | undefined
  /** Courses whose re-balance is being worked out */
  working?: ReadonlySet<string> | undefined
  /** Without it the lanes only show */
  edit?: LaneEditing | undefined
}

const NO_CHANGES: ReadonlyMap<string, LaneChange> = new Map()
const NONE: ReadonlySet<string> = new Set()
// Monday lines need this much room a week, or they turn into a grey wash.
const WEEK_LINE_PX = 24
// Today lands this far from the names after a jump to it, so the days just before it show too.
const TODAY_INSET = 48

/**
 * Every course as a lane over the months: its sessions, its spare or late days and its deadline, with today. The whole
 * plan fits the width; a closer zoom scrolls sideways under the names. A course the draft changes is drawn over the
 * course as it was.
 */
export function TimelineChart({
  lanes,
  changes = NO_CHANGES,
  moved = NONE,
  range,
  now,
  selected = null,
  working = NONE,
  edit,
}: Props) {
  const id = useId()
  const [zoom, setZoom] = useZoom()
  const [showBefore, setShowBefore] = useState(true)
  const scroller = useRef<HTMLDivElement>(null)
  const axis = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  const scale = useMemo(() => scaleOf(range), [range])
  const ticks = useMemo(() => ticksOf(scale), [scale])
  const drawn = lanes.length > 0

  useEffect(() => {
    const el = axis.current
    if (!el) return undefined
    const observer = new ResizeObserver(() => setTrackWidth(el.getBoundingClientRect().width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [drawn])

  if (!drawn) return null
  const pxPerDay = trackWidth / scale.days
  const track = zoom === 'fit' ? 'minmax(0,1fr)' : `${Math.round(scale.days * PX_PER_DAY[zoom])}px`
  const zooms: { value: TimelineZoom; label: string }[] = [
    { value: 'fit', label: m.timeline_zoom_fit() },
    { value: 'month', label: m.timeline_zoom_month() },
    { value: 'week', label: m.timeline_zoom_week() },
  ]

  function toToday() {
    const box = scroller.current
    if (!box || now === null) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const left = ((now - scale.start) / DAY) * pxPerDay - TODAY_INSET
    box.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section aria-label={m.timeline()} className="min-w-0 rounded-2xl border border-line bg-surface print:hidden">
      <div className="flex flex-wrap items-center gap-2 px-3.5 pt-3 pb-2.5 text-[13px] md:px-5">
        <Segmented label={m.timeline_zoom()} value={zoom} options={zooms} onChange={setZoom} />
        {zoom !== 'fit' && now !== null && (
          <Button className="py-1! text-[13px]" onClick={toToday}>
            {m.go_today()}
          </Button>
        )}
        {changes.size > 0 && (
          <label className="ml-auto flex cursor-pointer items-center gap-2 font-medium">
            <input
              type="checkbox"
              className="size-4 accent-[var(--focus)]"
              checked={showBefore}
              onChange={(e) => setShowBefore(e.target.checked)}
            />
            {m.timeline_show_before()}
          </label>
        )}
      </div>
      {/* Focusable, so the days can be scrolled by keys even when nothing in them can be pressed. */}
      <div
        ref={scroller}
        data-scroller
        role="group"
        aria-label={m.timeline_days()}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scroller has to take focus to be scrolled
        tabIndex={0}
        className="overflow-x-auto overscroll-x-contain border-t border-line-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <div
          className="grid grid-cols-[var(--names)_var(--track)] [--names:136px] md:[--names:240px]"
          style={{ '--track': track }}
        >
          <div className="sticky left-0 z-20 border-b border-line bg-surface" />
          <TimelineAxis ref={axis} scale={scale} ticks={ticks} now={now} pxPerDay={pxPerDay} />
          {lanes.map((lane) => (
            <LaneRow
              key={lane.calendar.id}
              lane={lane}
              change={changes.get(lane.calendar.id)}
              showBefore={showBefore}
              moved={moved}
              scale={scale}
              ticks={ticks}
              weekLines={pxPerDay * 7 >= WEEK_LINE_PX}
              now={now}
              selected={selected === lane.calendar.id}
              working={working.has(lane.calendar.id)}
              edit={edit}
              keysHint={`${id}-keys`}
            />
          ))}
        </div>
      </div>
      <TimelineLegend changed={changes.size > 0} />
      <p id={`${id}-keys`} hidden>
        {m.timeline_keys()}
      </p>
    </section>
  )
}
