import { fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  countsToBudget,
  DAY,
  durationHours,
  hm,
  isSession,
  type Occurrence,
  type Plan,
  type PlanChange,
  type PlanEvent,
  startOfDay,
  toLocalString,
} from '@lc/plan-domain'
import { Button, calendarColor, Check, Dot, Segmented, Trash2, X } from '@lc/ui'
import { useEffect, useRef, useState } from 'react'

import { useFillHeight } from '../../../shared/lib'

type Filter = 'all' | 'open' | 'done' | 'overdue'

interface Props {
  plan: Plan
  /** Every occurrence to list, in time order, with the hidden calendars already left out */
  items: Occurrence[]
  /** Minsk wall-clock ms; null before the clock is known, as on the server */
  now: number | null
  /** Called with the event that was clicked: the page opens its dialog */
  onSelect: (e: PlanEvent) => void
  /**
   * Present when the plan can be edited: rows get a checkbox and the selection a bar of actions. Called with the
   * changes of one action, to be stored in order.
   */
  onChanges?: ((changes: PlanChange[]) => void) | undefined
}

const matches = (o: Occurrence, filter: Filter, now: number | null) =>
  filter === 'all' ||
  (filter === 'done' && o.done === true) ||
  (filter === 'open' && isSession(o) && !o.done) ||
  (filter === 'overdue' && isSession(o) && !o.done && now !== null && o.e < now)

/**
 * The whole plan grouped by day in its own scrolling box, opened at today. A filter narrows it to what is open,
 * done or overdue; on an editable plan several events can be ticked and changed together.
 */
export function AgendaList({ plan, items, now, onSelect, onChanges }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLHeadingElement>(null)
  const maxHeight = useFillHeight(box)
  const [filter, setFilter] = useState<Filter>('all')
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const today = now === null ? null : startOfDay(now)
  // Scrolls the box, not the page: the toolbar and the budget stay where they are.
  useEffect(() => {
    if (box.current && todayRef.current) box.current.scrollTop = todayRef.current.offsetTop - HEAD_ROOM
  }, [today, filter])

  if (!items.length) return <div className="px-[18px] py-10 text-center text-muted">{m.no_events()}</div>
  const colorOf = (id: string) => plan.calendars.find((c) => c.id === id)?.color ?? '#888'
  const shown = items.filter((o) => matches(o, filter, now))
  // A repeat is one of many: it is changed from its own card, not in bulk.
  const chosen = shown.filter((o) => !o.rrule && picked.has(o.uid))

  function act(changes: PlanChange[]) {
    onChanges?.(changes)
    setPicked(new Set())
  }
  const moveBy = (days: number): PlanChange[] => [
    {
      type: 'events.move',
      moves: chosen.map((o) => ({
        uid: o.uid,
        start: toLocalString(o.s + days * DAY),
        end: toLocalString(o.e + days * DAY),
      })),
    },
  ]
  const uids = chosen.map((o) => o.uid)

  // first day on or after today gets the scroll anchor
  const anchorDay = today === null ? null : (shown.find((o) => startOfDay(o.s) >= today)?.s ?? null)
  const anchor = anchorDay === null ? null : startOfDay(anchorDay)
  const hoursOf = new Map<number, number>()
  for (const o of shown) {
    if (countsToBudget(o)) hoursOf.set(startOfDay(o.s), (hoursOf.get(startOfDay(o.s)) ?? 0) + durationHours(o))
  }

  const rows: React.ReactNode[] = []
  let current: number | null = null
  for (const o of shown) {
    const d = startOfDay(o.s)
    if (d !== current) {
      current = d
      rows.push(
        <h2
          key={`d-${d}`}
          ref={d === anchor ? todayRef : undefined}
          className={`sticky top-[49px] z-1 flex items-baseline gap-2 bg-surface px-[18px] pt-3.5 pb-1.5 text-[13px]/[1.3] font-semibold ${d === today ? 'text-today-ink' : 'text-muted'}`}
        >
          {fmtDay(d)}
          {d === today ? ` — ${m.today()}` : ''}
          {hoursOf.has(d) && (
            <small className="ml-auto text-[12px] font-medium text-muted tabular-nums" title={m.study_that_day()}>
              {fmtHours(hoursOf.get(d) ?? 0)}
            </small>
          )}
        </h2>,
      )
    }
    rows.push(
      <div
        key={`${o.uid}-${o.s}`}
        className={`flex items-baseline hover:bg-surface-2 ${picked.has(o.uid) ? 'bg-[color-mix(in_srgb,var(--focus)_10%,var(--surface))]' : ''}`}
        style={calendarColor(colorOf(o.calendar))}
      >
        {onChanges && (
          <input
            type="checkbox"
            className="ml-[18px] size-4 flex-none translate-y-0.5 disabled:invisible"
            aria-label={m.list_select({ title: o.title })}
            disabled={Boolean(o.rrule)}
            checked={!o.rrule && picked.has(o.uid)}
            onChange={() => {
              const next = new Set(picked)
              if (!next.delete(o.uid)) next.add(o.uid)
              setPicked(next)
            }}
          />
        )}
        <button
          type="button"
          className={`grid min-w-0 flex-1 grid-cols-[96px_1fr] items-baseline gap-3 py-[7px] pr-[18px] text-left ${onChanges ? 'pl-3' : 'pl-[18px]'}`}
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
        </button>
      </div>,
    )
  }
  return (
    <div
      ref={box}
      className="relative max-h-[70dvh] overflow-y-auto overscroll-contain rounded-2xl pb-1.5"
      style={{ maxHeight }}
    >
      <div className="sticky top-0 z-2 flex min-h-[49px] flex-wrap items-center gap-2 border-b border-line-soft bg-surface px-[18px] py-2 text-[13px]">
        {chosen.length > 0 ? (
          <div role="group" aria-label={m.bulk_actions()} className="flex flex-wrap items-center gap-1.5">
            <b className="mr-1 font-semibold tabular-nums">{m.list_selected({ count: chosen.length })}</b>
            <Button className={BULK} onClick={() => act([{ type: 'events.done', uids, done: true }])}>
              <Check size={14} aria-hidden /> {m.bulk_done()}
            </Button>
            <Button className={BULK} onClick={() => act([{ type: 'events.done', uids, done: false }])}>
              {m.bulk_undone()}
            </Button>
            <Button className={BULK} onClick={() => act(moveBy(-1))}>
              {m.bulk_day_back()}
            </Button>
            <Button className={BULK} onClick={() => act(moveBy(1))}>
              {m.bulk_day_forward()}
            </Button>
            <Button className={BULK} onClick={() => act(moveBy(7))}>
              {m.bulk_week_forward()}
            </Button>
            <Button className={BULK} onClick={() => act(uids.map((uid) => ({ type: 'event.remove', uid })))}>
              <Trash2 size={14} aria-hidden /> {m.bulk_trash()}
            </Button>
            <Button
              className={BULK}
              aria-label={m.bulk_clear()}
              title={m.bulk_clear()}
              onClick={() => setPicked(new Set())}
            >
              <X size={14} aria-hidden />
            </Button>
          </div>
        ) : (
          <Segmented
            label={m.list_filter()}
            value={filter}
            options={[
              { value: 'all', label: m.list_all() },
              { value: 'open', label: m.list_open() },
              { value: 'done', label: m.list_done() },
              { value: 'overdue', label: m.list_overdue() },
            ]}
            onChange={setFilter}
          />
        )}
      </div>
      {rows}
      {!shown.length && <p className="px-[18px] py-10 text-center text-[13.5px] text-muted">{m.list_nothing()}</p>}
    </div>
  )
}

const BULK = 'flex items-center gap-1.5 px-2.5 py-1 text-[12.5px]'
/** The height of the bar that stays at the top of the list: a day heading stops under it. */
const HEAD_ROOM = 49
