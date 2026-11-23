import { m } from '@lc/i18n/messages'
import { DAY, type CalendarLane, type LaneChange } from '@lc/plan-domain'
import { Button, Segmented } from '@lc/ui'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { scaleOf, ticksOf } from '../lib/scale'
import { daysInView, wheelSideways } from '../lib/scroll'
import type { LaneEditing } from '../model/editing'
import { usePan } from '../model/use-pan'
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
  /** Pixels the chart fills: its lanes then scroll up and down inside it. Without it the chart is as tall as its lanes */
  height?: number | undefined
  /** Controls the host owns, at the end of the chart's own bar */
  tools?: ReactNode
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
  height,
  tools,
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
  const pan = usePan()
  // The day kept in the middle of the view across a change of zoom; the zoom it was last drawn at.
  const anchor = useRef<number | null>(null)
  const drawnAt = useRef(zoom)

  useEffect(() => {
    const el = axis.current
    if (!el) return undefined
    const observer = new ResizeObserver(() => setTrackWidth(el.getBoundingClientRect().width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [drawn])

  useEffect(() => {
    const box = scroller.current
    if (!box) return undefined
    // Not React's wheel: that one cannot keep the page from scrolling too.
    box.addEventListener('wheel', wheelSideways, { passive: false })
    return () => box.removeEventListener('wheel', wheelSideways)
  }, [drawn])

  // Before paint, so the days never show at the old offset: from the whole plan the view opens at today, from another
  // zoom it keeps the day that was in its middle.
  useLayoutEffect(() => {
    const box = scroller.current
    const ruler = axis.current
    const was = drawnAt.current
    drawnAt.current = zoom
    const day = anchor.current
    anchor.current = null
    if (!box || !ruler || was === zoom || zoom === 'fit') return
    const { visible } = daysInView(box, ruler)
    const perDay = PX_PER_DAY[zoom]
    const left =
      was === 'fit' || day === null
        ? now === null
          ? 0
          : ((now - scale.start) / DAY) * perDay - TODAY_INSET
        : day * perDay - visible / 2
    box.scrollLeft = Math.max(0, left)
  }, [zoom, now, scale.start])

  if (!drawn) return null
  const pxPerDay = trackWidth / scale.days
  const track = zoom === 'fit' ? 'minmax(0,1fr)' : `${Math.round(scale.days * PX_PER_DAY[zoom])}px`
  const zooms: { value: TimelineZoom; label: string }[] = [
    { value: 'fit', label: m.timeline_zoom_fit() },
    { value: 'month', label: m.timeline_zoom_month() },
    { value: 'week', label: m.timeline_zoom_week() },
  ]

  function chooseZoom(next: TimelineZoom) {
    const box = scroller.current
    const ruler = axis.current
    if (box && ruler && zoom !== 'fit') {
      const { visible } = daysInView(box, ruler)
      anchor.current = (box.scrollLeft + visible / 2) / (ruler.getBoundingClientRect().width / scale.days)
    }
    setZoom(next)
  }

  function toToday() {
    const box = scroller.current
    if (!box || now === null) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const left = ((now - scale.start) / DAY) * pxPerDay - TODAY_INSET
    box.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    // Its own stack: the sticky names stay over the days, never over a page header that stays at the top.
    <section
      aria-label={m.timeline()}
      className={`isolate min-w-0 rounded-2xl border border-line bg-surface print:hidden ${height === undefined ? '' : 'flex flex-col'}`}
      style={height === undefined ? undefined : { height }}
    >
      <div className="flex flex-wrap items-center gap-2 px-3.5 pt-3 pb-2.5 text-[13px] md:px-5">
        <Segmented label={m.timeline_zoom()} value={zoom} options={zooms} onChange={chooseZoom} />
        {zoom !== 'fit' && now !== null && (
          <Button className="py-1! text-[13px]" onClick={toToday}>
            {m.go_today()}
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          {changes.size > 0 && (
            <label className="flex cursor-pointer items-center gap-2 font-medium">
              <input
                type="checkbox"
                className="size-4 accent-[var(--focus)]"
                checked={showBefore}
                onChange={(e) => setShowBefore(e.target.checked)}
              />
              {m.timeline_show_before()}
            </label>
          )}
          {tools}
        </div>
      </div>
      {/* Focusable, so the days can be scrolled by keys even when nothing in them can be pressed. */}
      <div
        ref={scroller}
        data-scroller
        role="group"
        aria-label={m.timeline_days()}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scroller has to take focus to be scrolled
        tabIndex={0}
        className={`overflow-x-auto overscroll-x-contain border-t ${height === undefined ? '' : 'min-h-0 flex-1'} border-line-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${zoom === 'fit' ? '' : '[&_[data-axis]]:cursor-grab [&_[data-track]]:cursor-grab'} ${pan.panning ? 'select-none [&_*]:cursor-grabbing!' : ''}`}
        onPointerDown={pan.onPointerDown}
      >
        <div
          className="grid grid-cols-[var(--names)_var(--track)] [--names:136px] md:[--names:240px]"
          style={{ '--track': track }}
        >
          {/* Over the names and the days alike while the lanes scroll under them. */}
          <div className="sticky top-0 left-0 z-30 border-b border-line bg-surface" />
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
