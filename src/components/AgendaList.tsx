import { useEffect, useRef } from 'react'
import { fmtDay, hm, startOfDay } from '#/lib/plan/dates'
import type { Occurrence } from '#/lib/plan/occurrences'
import type { Plan, PlanEvent } from '#/lib/plan/types'

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

  if (!items.length) return <div className="empty">Нет событий. Включите хотя бы один календарь.</div>
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
        <h3 key={`d-${d}`} ref={d === anchor ? todayRef : undefined} className={d === today ? 'isToday' : undefined}>
          {fmtDay(d)}
          {d === today ? ' — сегодня' : ''}
        </h3>,
      )
    }
    rows.push(
      <button
        key={`${o.uid}-${o.s}`}
        type="button"
        className={`row${o.availability === 'free' ? ' free' : ''}`}
        style={{ '--c': colorOf(o.calendar) } as React.CSSProperties}
        onClick={() => onSelect(o)}
      >
        <time>{o.allDay ? 'весь день' : `${hm(o.s)}–${hm(o.e)}`}</time>
        <span>
          <i />
          {o.title}
        </span>
      </button>,
    )
  }
  return <div className="list">{rows}</div>
}
