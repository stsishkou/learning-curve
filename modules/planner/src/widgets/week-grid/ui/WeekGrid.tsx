import { dowShort, fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  countsToBudget,
  DAY,
  durationHours,
  hm,
  HOUR,
  layoutLanes,
  type Occurrence,
  type Plan,
  type PlanEvent,
  startOfDay,
  toLocalString,
  ymd,
} from '@lc/plan-domain'
import { calendarColor, Repeat } from '@lc/ui'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { useFillHeight } from '../../../shared/lib'

interface Props {
  plan: Plan
  /** Monday of the week, Minsk wall-clock ms */
  weekStart: number
  /** All 24 hours in a scrolling grid; otherwise only the hours around the week's events */
  fullDay?: boolean
  /** The occurrences of that week, with the hidden calendars already left out */
  items: Occurrence[]
  /** Minsk wall-clock ms; null before the clock is known, as on the server */
  now: number | null
  /** Called with the event that was clicked: the page opens its dialog */
  onSelect: (e: PlanEvent) => void
  /** Present when the plan can be edited: called with the new slot (wall-clock ms) of a dragged or resized event */
  onMove?: (o: Occurrence, slot: { s: number; e: number }) => void
  /** Called when Delete is pressed on a focused event */
  onRemove?: (o: Occurrence) => void
  /**
   * Present when events can be added: called with the slot that was double-clicked, or with the start and the end
   * of the stretch drawn with the pointer on an empty part of a day, `YYYY-MM-DDTHH:MM`
   */
  onCreate?: (start: string, end?: string) => void
  /** An event that is not stored yet, drawn dashed in its slot while its form is open */
  draft?: DraftSlot | null
  /** uid of the event whose dialog is open: it gets a ring */
  selectedUid?: string | null
}

export interface DraftSlot {
  /** wall-clock ms */
  s: number
  e: number
  title: string
  /** id of the calendar it takes its color from */
  calendar: string
}

const PX_PER_HOUR = 56
/** The `lg` breakpoint: from here the page puts the side panel next to the grid. */
const TWO_COLUMNS = 961
const SNAP = HOUR / 2
/** Pointer travel in px before a press counts as a drag instead of a click */
const DRAG_THRESHOLD = 5
/** How long a finger rests on an event before it is picked up, in ms */
const LONG_PRESS = 350
/** How long the focus is given back to an event moved with the keyboard, in ms */
const REFOCUS_FOR = 3000

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
// A done event is toned down through its colours, not opacity: its text has to stay readable.
const EVENT_DONE =
  'border-[color-mix(in_srgb,var(--c)_45%,var(--surface))] bg-[color-mix(in_srgb,var(--c)_6%,var(--surface))] text-muted hover:bg-[color-mix(in_srgb,var(--c)_14%,var(--surface))]'
const EVENT_LAB = 'shadow-[inset_0_0_0_1.5px_var(--c)]'
// A long press picks an event up: it must not select text or open the system menu instead.
const TOUCH_QUIET = 'select-none [-webkit-touch-callout:none]'

const shortTitle = (o: Occurrence) =>
  o.kind === 'study' || o.kind === 'lab' ? o.title.replace(/^[^—]+— /, '') : o.title

interface Press {
  x: number
  y: number
  columnWidth: number
  moved: boolean
  /** false while a finger waits out the long press */
  armed: boolean
  timer?: number
}

interface Drag {
  key: string
  /** `day` moves an all-day event between columns */
  mode: 'move' | 'resize' | 'resize-start' | 'day'
  /** new wall-clock ms while the pointer is down */
  s: number
  e: number
  /** horizontal shift in px, in whole day columns */
  shiftX: number
}

const keyOf = (o: Occurrence) => `${o.uid}-${o.s}`
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/**
 * Seven day columns with the events of one week. With `onMove`, `onRemove` and `onCreate` it is an editor: drag an
 * event to move it, drag its edge to resize, double-click an empty slot to add one, or do the same from the
 * keyboard. On a touch screen a long press picks an event up.
 */
export function WeekGrid({
  plan,
  weekStart,
  fullDay = false,
  items,
  now,
  onSelect,
  onMove,
  onRemove,
  onCreate,
  draft = null,
  selectedUid = null,
}: Props) {
  const timed = items.filter((o) => !o.allDay)
  const allDay = items.filter((o) => o.allDay)
  let minH = 8
  let maxH = 15
  for (const o of timed) {
    minH = Math.min(minH, new Date(o.s).getUTCHours())
    maxH = Math.max(maxH, Math.ceil((o.e - startOfDay(o.e)) / HOUR) || 24)
  }
  const firstBusyHour = minH
  // The hours grow to hold the event being created, so its block is never cut off by the last row.
  if (draft && draft.e > draft.s && draft.s >= weekStart && draft.s < weekStart + 7 * DAY) {
    minH = Math.min(minH, new Date(draft.s).getUTCHours())
    maxH = Math.max(maxH, Math.ceil((draft.e - startOfDay(draft.e)) / HOUR) || 24)
  }
  if (fullDay) {
    minH = 0
    maxH = 24
  }
  const height = (maxH - minH) * PX_PER_HOUR
  const hours = Array.from({ length: maxH - minH - 1 }, (_, i) => minH + 1 + i)
  const days = Array.from({ length: 7 }, (_, i) => weekStart + i * DAY)
  const today = now === null ? null : startOfDay(now)
  const colorOf = (id: string) => plan.calendars.find((c) => c.id === id)?.color ?? '#888'
  const studyHours = (day: number) =>
    timed.reduce((sum, o) => (startOfDay(o.s) === day && countsToBudget(o) ? sum + durationHours(o) : sum), 0)

  // On a narrow screen only some days fit: start at today when it is in this week.
  const scroller = useRef<HTMLDivElement>(null)
  // Next to the side panel the grid ends at the bottom of the screen and scrolls inside itself; the full day
  // does so at any width, it is too tall for a page.
  const maxHeight = useFillHeight(scroller, true, { minWidth: fullDay ? 0 : TWO_COLUMNS })
  useEffect(() => {
    const column = today === null ? null : scroller.current?.querySelector<HTMLElement>(`[data-day="${ymd(today)}"]`)
    if (column && scroller.current) scroller.current.scrollLeft = column.offsetLeft - 52
  }, [today, weekStart])
  // The full day opens at the first hour that has something, not at midnight.
  // Only on opening the full day or another week: an edit that changes the first hour must not move the view.
  const openAt = useRef(firstBusyHour)
  useEffect(() => {
    openAt.current = firstBusyHour
  }, [firstBusyHour])
  useEffect(() => {
    if (fullDay && scroller.current) scroller.current.scrollTop = openAt.current * PX_PER_HOUR
  }, [fullDay, weekStart])

  const [drag, setDrag] = useState<Drag | null>(null)
  // A stretch being drawn on an empty part of a day: `anchor` is where the pointer went down.
  const [drawn, setDrawn] = useState<{ anchor: number; s: number; e: number } | null>(null)
  const drawing = useRef<{ y: number; columnY: number; day: number; anchor: number } | null>(null)
  const slotAt = (day: number, y: number) => day + Math.round(((y / PX_PER_HOUR + minH) * HOUR) / SNAP) * SNAP

  function drawStart(e: PointerEvent<HTMLDivElement>, day: number) {
    // A finger scrolls the grid; it adds an event with a double tap or the toolbar button.
    if (!onCreate || e.button !== 0 || e.pointerType === 'touch') return
    if (e.target instanceof Element && e.target.closest('button')) return
    const columnY = e.currentTarget.getBoundingClientRect().y
    drawing.current = { y: e.clientY, columnY, day, anchor: slotAt(day, e.clientY - columnY) }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function drawMove(e: PointerEvent<HTMLDivElement>) {
    const d = drawing.current
    if (!d || (!drawn && Math.abs(e.clientY - d.y) < DRAG_THRESHOLD)) return
    const at = clamp(slotAt(d.day, e.clientY - d.columnY), d.day + minH * HOUR, d.day + maxH * HOUR)
    setDrawn({ anchor: d.anchor, s: Math.min(d.anchor, at), e: Math.max(d.anchor, at) })
  }

  function drawEnd() {
    const stretch = drawn
    drawing.current = null
    if (!stretch) return
    const end = Math.max(stretch.e, stretch.s + 2 * SNAP)
    // After the click that ends this press: it would land outside the dialog that opens and close it at once.
    window.setTimeout(() => {
      setDrawn(null)
      onCreate?.(toLocalString(stretch.s), toLocalString(end))
    }, 50)
  }
  const press = useRef<Press | null>(null)
  // The click that follows a drag must not open the event dialog.
  const suppressClick = useRef(false)
  // An event moved with the keyboard is drawn anew in its slot, first as a preview and again when the change is
  // stored; each redraw can drop the focus, so it is given back for a short while after the key press.
  const refocus = useRef<{ key: string; slot: string; until: number } | null>(null)
  useEffect(() => {
    const wanted = refocus.current
    if (!wanted) return
    if (Date.now() > wanted.until) {
      refocus.current = null
      return
    }
    // A repeat moved out of its series comes back as a new event: it is found by its title and its slot.
    const find = (name: string, value: string) =>
      scroller.current?.querySelector<HTMLElement>(`[data-${name}="${CSS.escape(value)}"]`)
    const target = find('key', wanted.key) ?? find('slot', wanted.slot)
    if (target && document.activeElement !== target) target.focus()
  })

  // A finger that has picked an event up must move it, not scroll the grid: only a non-passive listener can say so.
  useEffect(() => {
    const element = scroller.current
    if (!element) return undefined
    const hold = (e: TouchEvent) => {
      if (press.current?.armed) e.preventDefault()
    }
    element.addEventListener('touchmove', hold, { passive: false })
    return () => element.removeEventListener('touchmove', hold)
  }, [])

  function pointerDown(e: PointerEvent<HTMLElement>, o: Occurrence, wanted: Drag['mode']) {
    if (!onMove || e.button !== 0) return
    const column = e.currentTarget.closest('[data-day]')
    if (!column) return
    e.stopPropagation()
    const touch = e.pointerType === 'touch'
    // The edges are too thin for a finger: there it always moves, and the length is changed in the event card.
    const mode = touch && wanted !== 'day' ? 'move' : wanted
    const begin = () => setDrag({ key: keyOf(o), mode, s: o.s, e: o.e, shiftX: 0 })
    const next: Press = {
      x: e.clientX,
      y: e.clientY,
      columnWidth: column.getBoundingClientRect().width,
      moved: false,
      armed: !touch,
    }
    press.current = next
    if (!touch) {
      e.currentTarget.setPointerCapture(e.pointerId)
      begin()
      return
    }
    // A finger scrolls the grid; it picks an event up only after resting on it.
    next.timer = window.setTimeout(() => {
      next.armed = true
      navigator.vibrate?.(8)
      begin()
    }, LONG_PRESS)
  }

  function pointerMove(e: PointerEvent<HTMLElement>, o: Occurrence) {
    const p = press.current
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.armed) {
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) release()
      return
    }
    if (!drag || drag.key !== keyOf(o)) return
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
    if (drag.mode === 'resize-start') {
      setDrag({ ...drag, s: clamp(o.s + shift, first, o.e - SNAP) })
      return
    }
    const dayIndex = (day - weekStart) / DAY
    const dayShift = clamp(Math.round(dx / p.columnWidth), -dayIndex, 6 - dayIndex)
    const length = o.e - o.s
    const s = drag.mode === 'day' ? o.s : clamp(o.s + shift, first, last - length)
    setDrag({ ...drag, s: s + dayShift * DAY, e: s + length + dayShift * DAY, shiftX: dayShift * p.columnWidth })
  }

  function release() {
    window.clearTimeout(press.current?.timer)
    press.current = null
    setDrag(null)
  }

  function pointerUp(o: Occurrence) {
    const p = press.current
    const dropped = drag
    release()
    if (!p?.moved || !dropped) return
    suppressClick.current = true
    // Cleared on a timer too, in case the browser sends no click after this drag.
    window.setTimeout(() => (suppressClick.current = false), 50)
    if (dropped.s !== o.s || dropped.e !== o.e) onMove?.(o, { s: dropped.s, e: dropped.e })
  }

  /** Alt + arrows move the focused event, with Shift they change its length, Delete removes it. */
  function keyDown(e: KeyboardEvent<HTMLElement>, o: Occurrence) {
    if (!onMove) return
    let { s, e: end } = o
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!onRemove) return
      onRemove(o)
    } else if (!e.altKey) {
      return
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const shift = e.key === 'ArrowLeft' ? -DAY : DAY
      s += shift
      end += shift
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !o.allDay) {
      const shift = e.key === 'ArrowUp' ? -SNAP : SNAP
      if (!e.shiftKey) s += shift
      end += shift
    } else {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const sameDay = o.allDay || startOfDay(end - 1) === startOfDay(s)
    if ((s === o.s && end === o.e) || end - s < SNAP || !sameDay) return
    refocus.current = { key: `${o.uid}-${s}`, slot: `${o.title}@${s}`, until: Date.now() + REFOCUS_FOR }
    onMove(o, { s, e: end })
  }

  const handlers = (o: Occurrence, mode: Drag['mode']) => ({
    'data-key': keyOf(o),
    'data-slot': `${o.title}@${o.s}`,
    onPointerDown: (ev: PointerEvent<HTMLElement>) => pointerDown(ev, o, mode),
    onPointerMove: (ev: PointerEvent<HTMLElement>) => pointerMove(ev, o),
    onPointerUp: () => pointerUp(o),
    onPointerCancel: release,
    onKeyDown: (ev: KeyboardEvent<HTMLElement>) => keyDown(ev, o),
    onClick: () => {
      if (suppressClick.current) suppressClick.current = false
      else onSelect(o)
    },
  })

  return (
    <div className="relative">
      <div
        ref={scroller}
        className={`snap-x scroll-pl-[52px] overflow-auto rounded-2xl ${fullDay ? 'max-h-[70dvh]' : ''}`}
        style={{ maxHeight }}
      >
        <div className="grid min-w-[760px] grid-cols-[52px_repeat(7,minmax(96px,1fr))]">
          <div className={`${HEAD} ${PINNED} top-0 z-6 rounded-tl-2xl`} />
          {days.map((d) => {
            const off = plan.meta.holidays.includes(ymd(d))
            return (
              <div
                key={d}
                className={`${HEAD} sticky top-0 z-5 snap-start bg-surface px-2 pt-2.5 pb-2 text-[13px] ${off ? DAY_OFF : ''} ${d === days[6] ? 'rounded-tr-2xl' : ''}`}
              >
                {dowShort(d)}
                {studyHours(d) > 0 && (
                  <small className="float-right text-[11.5px] tabular-nums" title={m.study_that_day()}>
                    {fmtHours(studyHours(d))}
                  </small>
                )}
                <b
                  className={`block text-[18px]/[1.1] font-semibold tabular-nums ${d === today ? 'text-today-ink' : 'text-ink'}`}
                >
                  {new Date(d).getUTCDate()}
                </b>
                {off && <small className="mt-0.5 block text-[11px] text-today-ink">{m.day_off()}</small>}
              </div>
            )
          })}

          {allDay.length > 0 && (
            <>
              <div className={`${HEAD} ${PINNED} px-2 py-1.5 text-[11px]`}>{m.all_day()}</div>
              {days.map((d) => (
                <div
                  key={d}
                  data-day={ymd(d)}
                  className="grid min-w-0 content-start gap-1 border-b border-line-soft p-1"
                >
                  {allDay
                    .filter((o) => o.s === d)
                    .map((o) => {
                      const dragged = drag?.key === keyOf(o) ? drag : null
                      return (
                        <button
                          key={o.uid}
                          type="button"
                          className={`${TOUCH_QUIET} truncate rounded-md bg-[color-mix(in_srgb,var(--today)_14%,var(--surface))] px-1.5 py-[3px] text-left text-[12px] font-semibold text-today-ink ${onMove ? 'cursor-grab' : ''} ${dragged ? 'relative z-3 cursor-grabbing opacity-85 ring-2 ring-focus' : ''}`}
                          style={{ transform: dragged?.shiftX ? `translateX(${dragged.shiftX}px)` : undefined }}
                          title={`${fmtDay(o.s)}: ${o.title}`}
                          {...handlers(o, 'day')}
                        >
                          {o.title}
                        </button>
                      )
                    })}
                </div>
              ))}
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
              // The keyboard path to a new event is the toolbar button and the N key.
              // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
              <div
                key={d}
                data-day={ymd(d)}
                className="relative border-r border-line-soft select-none last:border-r-0"
                style={{ height }}
                onPointerDown={(e) => drawStart(e, d)}
                onPointerMove={drawMove}
                onPointerUp={drawEnd}
                onPointerCancel={() => ((drawing.current = null), setDrawn(null))}
                onDoubleClick={(e) => {
                  if (!onCreate || (e.target instanceof Element && e.target.closest('button'))) return
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().y
                  const slot = Math.floor(((y / PX_PER_HOUR + minH) * HOUR) / SNAP) * SNAP
                  onCreate(toLocalString(d + clamp(slot, 0, DAY - HOUR)))
                }}
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
                  return (
                    <button
                      key={keyOf(o)}
                      type="button"
                      className={`${EVENT} ${TOUCH_QUIET} ${o.done ? EVENT_DONE : o.availability === 'free' ? EVENT_FREE : EVENT_BUSY} ${o.kind === 'lab' && !o.done ? EVENT_LAB : ''} ${dragged ? 'z-3 cursor-grabbing opacity-85 ring-2 ring-focus' : o.uid === selectedUid ? 'z-3 ring-2 ring-focus' : ''}`}
                      style={{
                        ...calendarColor(colorOf(o.calendar)),
                        top: ((s - startOfDay(s)) / HOUR - minH) * PX_PER_HOUR + 1,
                        height: Math.max(22, ((e - s) / HOUR) * PX_PER_HOUR - 3),
                        left: `calc(${(lane / count) * 100}% + 4px)`,
                        width: `calc(${100 / count}% - 8px)`,
                        transform: dragged?.shiftX ? `translateX(${dragged.shiftX}px)` : undefined,
                      }}
                      {...handlers(o, 'move')}
                    >
                      <b className={`block font-semibold ${o.done ? 'line-through decoration-done' : ''}`}>
                        {o.done && <span className="mr-1 inline-block text-done-ink no-underline">✓</span>}
                        {shortTitle(o)}
                      </b>
                      <small className="text-muted tabular-nums">
                        {hm(s)}–{hm(e)}
                      </small>
                      {o.rrule && <Repeat aria-hidden size={11} className="absolute top-1.5 right-1.5 text-muted" />}
                      {onMove && (
                        <>
                          <span
                            aria-hidden
                            className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
                            onPointerDown={(ev) => pointerDown(ev, o, 'resize-start')}
                          />
                          <span
                            aria-hidden
                            className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                            onPointerDown={(ev) => pointerDown(ev, o, 'resize')}
                          />
                        </>
                      )}
                    </button>
                  )
                })}
                {[drawn && { ...drawn, title: '', calendar: '' }, draft]
                  .filter((slot) => slot !== null && slot.e > slot.s && startOfDay(slot.s) === d)
                  .slice(0, 1)
                  .map((slot) => (
                    <div
                      key="draft"
                      data-draft
                      className="pointer-events-none absolute inset-x-1 z-4 overflow-hidden rounded-lg border-2 border-dashed border-focus bg-[color-mix(in_srgb,var(--focus)_16%,transparent)] px-[7px] py-[3px] text-[12px]/[1.3]"
                      style={{
                        top: ((slot!.s - d) / HOUR - minH) * PX_PER_HOUR + 1,
                        height: Math.max(22, ((slot!.e - slot!.s) / HOUR) * PX_PER_HOUR - 3),
                      }}
                    >
                      <b className="block truncate font-semibold">{slot!.title || m.new_event()}</b>
                      <small className="text-muted tabular-nums">
                        {hm(slot!.s)}–{hm(slot!.e)}
                      </small>
                    </div>
                  ))}
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
      {/* Over the grid, not under it: the grid already ends where the window does. */}
      {!items.length && (
        <div className="pointer-events-none absolute inset-x-4 top-24 mx-auto w-fit max-w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-center text-[13.5px] text-muted shadow-card">
          {m.no_events_this_week()}
        </div>
      )}
    </div>
  )
}
