import { useEffect, useRef } from 'react'
import { fmtDay } from '#/lib/format'
import { hm, startOfDay } from '#/lib/plan/dates'
import type { Occurrence } from '#/lib/plan/occurrences'
import type { Plan, PlanEvent } from '#/lib/plan/types'
import { m } from '#/paraglide/messages.js'
import { Dot, calendarColor } from './ui'

interface Props {
  plan: Plan
  items: Occurrence[]
  now: number | null
  onSelect: (e: PlanEvent) => void
}

/** The whole plan grouped by day; scrolls to today once mounted. */
export function AgendaList({ plan, items, now, onSelect }: Props) {
  const todayRef = useRef<HTMLHeadingElement>(null)
  const today = now === null ? null : startOfDay(now)
  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'start' })
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
        <h3
          key={`d-${d}`}
          ref={d === anchor ? todayRef : undefined}
          className={`sticky top-0 bg-surface px-[18px] pt-3.5 pb-1.5 text-[13px]/[1.3] font-semibold ${d === today ? 'text-today' : 'text-muted'}`}
        >
          {fmtDay(d)}
          {d === today ? ` — ${m.today()}` : ''}
        </h3>,
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
        <time className="text-[13.5px] text-muted tabular-nums">{o.allDay ? m.all_day() : `${hm(o.s)}–${hm(o.e)}`}</time>
        <span className={`flex items-baseline gap-2 ${o.availability === 'free' ? 'text-muted' : ''}`}>
          <Dot className="size-[9px] -translate-y-px" />
          {o.title}
        </span>
      </button>,
    )
  }
  return <div className="py-1.5">{rows}</div>
}
