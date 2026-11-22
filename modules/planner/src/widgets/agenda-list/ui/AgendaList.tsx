import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, type Occurrence, type Plan, type PlanEvent, startOfDay } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'
import { useEffect, useRef } from 'react'

import { useFillHeight } from '../../../shared/lib'

interface Props {
  plan: Plan
  /** Every occurrence to list, in time order, with the hidden calendars already left out */
  items: Occurrence[]
  /** Minsk wall-clock ms; null before the clock is known, as on the server */
  now: number | null
  /** Called with the event that was clicked: the page opens its dialog */
  onSelect: (e: PlanEvent) => void
}

/** The whole plan grouped by day in its own scrolling box, opened at today. */
export function AgendaList({ plan, items, now, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLHeadingElement>(null)
  const maxHeight = useFillHeight(box)
  const today = now === null ? null : startOfDay(now)
  // Scrolls the box, not the page: the toolbar and the budget stay where they are.
  useEffect(() => {
    if (box.current && todayRef.current) box.current.scrollTop = todayRef.current.offsetTop
  }, [today])

  if (!items.length) return <div className="px-[18px] py-10 text-center text-muted">{m.no_events()}</div>
  const colorOf = (id: string) => plan.calendars.find((c) => c.id === id)?.color ?? '#888'

  // first day on or after today gets the scroll anchor
  const anchorDay = today === null ? null : (items.find((o) => startOfDay(o.s) >= today)?.s ?? null)
  const anchor = anchorDay === null ? null : startOfDay(anchorDay)

  const rows: React.ReactNode[] = []
  let current: number | null = null
  for (const o of items) {
    const d = startOfDay(o.s)
    if (d !== current) {
      current = d
      rows.push(
        <h2
          key={`d-${d}`}
          ref={d === anchor ? todayRef : undefined}
          className={`sticky top-0 z-1 bg-surface px-[18px] pt-3.5 pb-1.5 text-[13px]/[1.3] font-semibold ${d === today ? 'text-today-ink' : 'text-muted'}`}
        >
          {fmtDay(d)}
          {d === today ? ` — ${m.today()}` : ''}
        </h2>,
      )
    }
    rows.push(
      <button
        key={`${o.uid}-${o.s}`}
        type="button"
        className="grid w-full grid-cols-[96px_1fr] items-baseline gap-3 px-[18px] py-[7px] text-left hover:bg-surface-2"
        style={calendarColor(colorOf(o.calendar))}
        onClick={() => onSelect(o)}
      >
        <time className="text-[13.5px] text-muted tabular-nums">
          {o.allDay ? m.all_day() : `${hm(o.s)}–${hm(o.e)}`}
        </time>
        <span
          className={`flex items-baseline gap-2 ${o.availability === 'free' || o.done ? 'text-muted' : ''} ${o.done ? 'line-through decoration-done' : ''}`}
        >
          <Dot className="size-[9px] -translate-y-px" />
          {o.title}
          {o.done && <span className="text-done-ink no-underline">✓</span>}
        </span>
      </button>,
    )
  }
  return (
    <div
      ref={box}
      className="relative max-h-[70dvh] overflow-y-auto overscroll-contain rounded-2xl pb-1.5"
      style={{ maxHeight }}
    >
      {rows}
    </div>
  )
}
