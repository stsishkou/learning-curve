import { dowShort, fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, hm, startOfDay, ymd, type Occurrence, type Plan, type PlanEvent } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'
import { useRef, useState, type PointerEvent } from 'react'

const SHOWN = 3
/** Pointer travel in px before a press counts as a drag instead of a click */
const DRAG_THRESHOLD = 5

interface Props {
  plan: Plan
  /** First day of the month on screen */
  monthStart: number
  /** Monday the grid begins with, and how many weeks it has */
  gridStart: number
  weeks: number
  /** The occurrences inside the grid, with the hidden calendars already left out */
  items: Occurrence[]
  /** Minsk wall-clock ms; null before the clock is known, as on the server */
  now: number | null
  /** Called with the event that was clicked: the page opens its dialog */
  onSelect: (e: PlanEvent) => void
  /** Opens the week view on that day */
  onPickDay: (day: number) => void
  /** Present when the plan can be edited: called with the new slot (wall-clock ms) of an event dropped on a day */
  onMove?: (o: Occurrence, slot: { s: number; e: number }) => void
}

/** A month at a glance: every day with its first events; the day number opens that week. */
export function MonthGrid({ plan, monthStart, gridStart, weeks, items, now, onSelect, onPickDay, onMove }: Props) {
  const [drag, setDrag] = useState<{ key: string; target: number } | null>(null)
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  // The click that follows a drag must not open the event dialog.
  const suppressClick = useRef(false)

  function pointerMove(e: PointerEvent<HTMLElement>, o: Occurrence) {
    const p = press.current
    if (!p) return
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_THRESHOLD) return
    p.moved = true
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-month-day]')
    const target = cell ? Number(cell.dataset.monthDay) : startOfDay(o.s)
    setDrag({ key: `${o.uid}-${o.s}`, target })
  }

  function pointerUp(o: Occurrence) {
    const moved = press.current?.moved
    const target = drag?.target
    press.current = null
    setDrag(null)
    if (!moved) return
    suppressClick.current = true
    window.setTimeout(() => (suppressClick.current = false), 50)
    const shift = (target ?? startOfDay(o.s)) - startOfDay(o.s)
    if (shift) onMove?.(o, { s: o.s + shift, e: o.e + shift })
  }

  const today = now === null ? null : startOfDay(now)
  const month = new Date(monthStart).getUTCMonth()
  const colorOf = (id: string) => plan.calendars.find((c) => c.id === id)?.color ?? '#888'
  const byDay = new Map<number, Occurrence[]>()
  for (const o of items) {
    const day = startOfDay(o.s)
    byDay.set(day, [...(byDay.get(day) ?? []), o])
  }
  const days = Array.from({ length: weeks * 7 }, (_, i) => gridStart + i * DAY)

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-[repeat(7,minmax(0,1fr))]">
        {days.slice(0, 7).map((d) => (
          <div key={d} className="border-b border-line px-2 py-2 text-[12.5px] text-muted">
            {dowShort(d)}
          </div>
        ))}
        {days.map((d) => {
          const list = byDay.get(d) ?? []
          const outside = new Date(d).getUTCMonth() !== month
          const off = plan.meta.holidays.includes(ymd(d))
          return (
            <div
              key={d}
              data-month-day={d}
              className={`min-h-[104px] min-w-0 overflow-hidden border-r border-b border-line-soft p-1.5 nth-[7n]:border-r-0 ${outside ? 'bg-surface-2/60' : ''} ${drag?.target === d ? 'bg-[color-mix(in_srgb,var(--focus)_12%,var(--surface))] shadow-[inset_0_0_0_2px_var(--focus)]' : ''}`}
            >
              <button
                type="button"
                className={`mb-1 grid size-7 place-items-center rounded-full text-[13px] font-semibold tabular-nums hover:bg-surface-2 ${
                  d === today ? 'bg-today text-surface hover:bg-today' : outside ? 'text-muted' : ''
                }`}
                aria-label={m.open_week_of({ date: fmtDay(d) })}
                onClick={() => onPickDay(d)}
              >
                {new Date(d).getUTCDate()}
              </button>
              {off && <small className="mb-1 block text-[11px] text-today-ink">{m.day_off()}</small>}
              <div className="grid gap-0.5">
                {list.slice(0, SHOWN).map((o) => (
                  <button
                    key={`${o.uid}-${o.s}`}
                    type="button"
                    className={`flex w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-px text-left text-[11.5px]/[1.5] select-none hover:bg-surface-2 ${o.done ? 'text-muted' : ''} ${onMove ? 'cursor-grab' : ''} ${drag?.key === `${o.uid}-${o.s}` ? 'cursor-grabbing opacity-50' : ''}`}
                    style={calendarColor(colorOf(o.calendar))}
                    onPointerDown={(e) => {
                      if (!onMove || e.button !== 0 || e.pointerType === 'touch') return
                      e.currentTarget.setPointerCapture(e.pointerId)
                      press.current = { x: e.clientX, y: e.clientY, moved: false }
                    }}
                    onPointerMove={(e) => pointerMove(e, o)}
                    onPointerUp={() => pointerUp(o)}
                    onPointerCancel={() => ((press.current = null), setDrag(null))}
                    onClick={() => {
                      if (suppressClick.current) suppressClick.current = false
                      else onSelect(o)
                    }}
                  >
                    <Dot className={`size-[7px] ${o.done ? 'opacity-45' : ''}`} />
                    {!o.allDay && <span className="flex-none text-muted tabular-nums">{hm(o.s)}</span>}
                    <span className={`min-w-0 truncate ${o.done ? 'line-through decoration-done' : ''}`}>
                      {o.title.replace(/^[^—]+— /, '')}
                    </span>
                  </button>
                ))}
                {list.length > SHOWN && (
                  <button
                    type="button"
                    className="px-1 text-left text-[11.5px] text-muted hover:text-ink"
                    onClick={() => onPickDay(d)}
                  >
                    {m.and_more({ count: list.length - SHOWN })}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
