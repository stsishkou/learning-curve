import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { dowShort, fmtDay } from '#/lib/format'
import { DAY, HOUR, hm, startOfDay, toLocalString, ymd } from '#/lib/plan/dates'
import { layoutLanes, type Occurrence } from '#/lib/plan/occurrences'
import type { Plan, PlanEvent } from '#/lib/plan/types'
import { m } from '#/paraglide/messages.js'

import { calendarColor } from './ui'

interface Props {
  plan: Plan
  weekStart: number
  items: Occurrence[]
  now: number | null
  onSelect: (e: PlanEvent) => void
  /** Present when the plan can be edited: called after an event is dragged or resized. */
  onMove?: (e: PlanEvent, slot: { start: string; end: string }) => void
}

const PX_PER_HOUR = 56
const SNAP = HOUR / 2
/** Pointer travel in px before a press counts as a drag instead of a click */
const DRAG_THRESHOLD = 5

const HEAD = 'border-b border-line text-muted'
// The hour column stays in place while the days scroll sideways on a narrow screen.
const PINNED = 'sticky left-0 z-4 bg-surface'
const DAY_OFF = 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--line-soft)_6px_8px)]'
const EVENT =
  'absolute overflow-hidden rounded-lg border-l-4 border-cal px-[7px] py-[5px] text-left text-[12px]/[1.3] text-ink'
const EVENT_BUSY =
  'bg-[color-mix(in_srgb,var(--c)_16%,var(--surface))] hover:bg-[color-mix(in_srgb,var(--c)_26%,var(--surface))]'
const EVENT_FREE =
  'border-dashed bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--c)_10%,var(--surface))_0_6px,var(--surface)_6px_12px)]'
const EVENT_LAB = 'shadow-[inset_0_0_0_1.5px_var(--c)]'

const shortTitle = (o: Occurrence) =>
  o.kind === 'study' || o.kind === 'lab' ? o.title.replace(/^[^—]+— /, '') : o.title

interface Drag {
  key: string
  mode: 'move' | 'resize'
  /** new wall-clock ms while the pointer is down */
  s: number
  e: number
  /** horizontal shift in px, in whole day columns */
  shiftX: number
}

const keyOf = (o: Occurrence) => `${o.uid}-${o.s}`
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function WeekGrid({ plan, weekStart, items, now, onSelect, onMove }: Props) {
  const timed = items.filter((o) => !o.allDay)
  const allDay = items.filter((o) => o.allDay)
  let minH = 8
  let maxH = 15
  for (const o of timed) {
    minH = Math.min(minH, new Date(o.s).getUTCHours())
    maxH = Math.max(maxH, Math.ceil((o.e - startOfDay(o.e)) / HOUR) || 24)
  }
  const height = (maxH - minH) * PX_PER_HOUR
  const hours = Array.from({ length: maxH - minH - 1 }, (_, i) => minH + 1 + i)
  const days = Array.from({ length: 7 }, (_, i) => weekStart + i * DAY)
  const today = now === null ? null : startOfDay(now)
  const colorOf = (id: string) => plan.calendars.find((c) => c.id === id)?.color ?? '#888'

  // On a narrow screen only some days fit: start at today when it is in this week.
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const column = today === null ? null : scroller.current?.querySelector<HTMLElement>(`[data-day="${ymd(today)}"]`)
    if (column && scroller.current) scroller.current.scrollLeft = column.offsetLeft - 52
  }, [today, weekStart])

  const [drag, setDrag] = useState<Drag | null>(null)
  const press = useRef<{ x: number; y: number; columnWidth: number; moved: boolean } | null>(null)
  // The click that follows a drag must not open the event dialog.
  const suppressClick = useRef(false)

  // A repeating event is one series: its time is changed in the dialog. Touch keeps scrolling the grid.
  const draggable = (o: Occurrence, e: PointerEvent) =>
    onMove !== undefined && !o.rrule && e.pointerType !== 'touch' && e.button === 0

  function pointerDown(e: PointerEvent<HTMLElement>, o: Occurrence, mode: Drag['mode']) {
    if (!draggable(o, e)) return
    const column = e.currentTarget.closest('[data-day]')
    if (!column) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    press.current = { x: e.clientX, y: e.clientY, columnWidth: column.getBoundingClientRect().width, moved: false }
    setDrag({ key: keyOf(o), mode, s: o.s, e: o.e, shiftX: 0 })
  }

  function pointerMove(e: PointerEvent<HTMLElement>, o: Occurrence) {
    const p = press.current
    if (!p || !drag || drag.key !== keyOf(o)) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    p.moved = true
    const day = startOfDay(o.s)
    const first = day + minH * HOUR
    const last = day + maxH * HOUR
    const shift = Math.round(((dy / PX_PER_HOUR) * HOUR) / SNAP) * SNAP
    if (drag.mode === 'resize') {
      setDrag({ ...drag, e: clamp(o.e + shift, o.s + SNAP, last) })
      return
    }
    const length = o.e - o.s
    const s = clamp(o.s + shift, first, last - length)
    const dayIndex = (day - weekStart) / DAY
    const dayShift = clamp(Math.round(dx / p.columnWidth), -dayIndex, 6 - dayIndex)
    setDrag({ ...drag, s: s + dayShift * DAY, e: s + length + dayShift * DAY, shiftX: dayShift * p.columnWidth })
  }

  function pointerUp(o: Occurrence) {
    const p = press.current
    press.current = null
    if (!p || !drag) return
    setDrag(null)
    if (!p.moved) return
    suppressClick.current = true
    // Cleared on a timer too, in case the browser sends no click after this drag.
    window.setTimeout(() => (suppressClick.current = false), 50)
    if (drag.s !== o.s || drag.e !== o.e) onMove?.(o, { start: toLocalString(drag.s), end: toLocalString(drag.e) })
  }

  return (
    <>
      <div ref={scroller} className="snap-x scroll-pl-[52px] overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-[52px_repeat(7,minmax(96px,1fr))]">
          <div className={`${HEAD} ${PINNED} rounded-tl-2xl`} />
          {days.map((d) => {
            const off = plan.meta.holidays.includes(ymd(d))
            return (
              <div key={d} className={`${HEAD} snap-start px-2 pt-2.5 pb-2 text-[13px] ${off ? DAY_OFF : ''}`}>
                {dowShort(d)}
                <b
                  className={`block text-[18px]/[1.1] font-semibold tabular-nums ${d === today ? 'text-today' : 'text-ink'}`}
                >
                  {new Date(d).getUTCDate()}
                </b>
                {off && <small className="mt-0.5 block text-[11px] text-today">{m.day_off()}</small>}
              </div>
            )
          })}

          {allDay.length > 0 && (
            <>
              <div className={`${HEAD} ${PINNED} px-2 py-1.5 text-[11px]`}>{m.all_day()}</div>
              <div className="col-[2/-1] flex flex-wrap gap-1.5 border-b border-line-soft px-2 py-1.5">
                {allDay.map((o) => (
                  <button
                    key={o.uid}
                    type="button"
                    className="rounded-md bg-[color-mix(in_srgb,var(--today)_14%,var(--surface))] px-2 py-[3px] text-[12px] font-semibold text-today"
                    onClick={() => onSelect(o)}
                  >
                    {fmtDay(o.s)}: {o.title}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className={`${PINNED} relative rounded-bl-2xl border-r border-line-soft`} style={{ height }}>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11.5px] text-muted tabular-nums"
                style={{ top: (h - minH) * PX_PER_HOUR }}
              >
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {days.map((d) => {
            const dayItems = timed.filter((o) => startOfDay(o.s) === d)
            const lanes = layoutLanes(dayItems)
            return (
              <div
                key={d}
                data-day={ymd(d)}
                className="relative border-r border-line-soft last:border-r-0"
                style={{ height }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-line-soft"
                    style={{ top: (h - minH) * PX_PER_HOUR }}
                  />
                ))}
                {dayItems.map((o) => {
                  const dragged = drag?.key === keyOf(o) ? drag : null
                  const s = dragged?.s ?? o.s
                  const e = dragged?.e ?? o.e
                  const { lane, lanes: count } = lanes.get(o) ?? { lane: 0, lanes: 1 }
                  const canDrag = onMove !== undefined && !o.rrule
                  return (
                    <button
                      key={keyOf(o)}
                      type="button"
                      className={`${EVENT} ${o.availability === 'free' ? EVENT_FREE : EVENT_BUSY} ${o.kind === 'lab' ? EVENT_LAB : ''} ${dragged ? 'z-3 cursor-grabbing opacity-85 select-none' : ''}`}
                      style={{
                        ...calendarColor(colorOf(o.calendar)),
                        top: ((s - startOfDay(s)) / HOUR - minH) * PX_PER_HOUR + 1,
                        height: Math.max(22, ((e - s) / HOUR) * PX_PER_HOUR - 3),
                        left: `calc(${(lane / count) * 100}% + 4px)`,
                        width: `calc(${100 / count}% - 8px)`,
                        transform: dragged?.shiftX ? `translateX(${dragged.shiftX}px)` : undefined,
                      }}
                      onPointerDown={(ev) => pointerDown(ev, o, 'move')}
                      onPointerMove={(ev) => pointerMove(ev, o)}
                      onPointerUp={() => pointerUp(o)}
                      onPointerCancel={() => ((press.current = null), setDrag(null))}
                      onClick={() => {
                        if (suppressClick.current) suppressClick.current = false
                        else onSelect(o)
                      }}
                    >
                      <b className="block font-semibold">{shortTitle(o)}</b>
                      <small className="text-muted tabular-nums">
                        {hm(s)}–{hm(e)}
                      </small>
                      {canDrag && (
                        <span
                          aria-hidden
                          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                          onPointerDown={(ev) => pointerDown(ev, o, 'resize')}
                        />
                      )}
                    </button>
                  )
                })}
                {now !== null && startOfDay(now) === d && (now - d) / HOUR >= minH && (now - d) / HOUR <= maxH && (
                  <div
                    className="absolute inset-x-0 z-2 h-0.5 bg-today before:absolute before:-top-[3px] before:-left-1 before:size-2 before:rounded-full before:bg-today before:content-['']"
                    style={{ top: ((now - d) / HOUR - minH) * PX_PER_HOUR }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
      {!items.length && <div className="px-[18px] py-10 text-center text-muted">{m.no_events_this_week()}</div>}
    </>
  )
}
