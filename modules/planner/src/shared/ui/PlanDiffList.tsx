import { fmtDay, fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { changedFields, hm, HOUR, parseLocal, type Plan, type PlanDiff, type PlanEvent } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'
import type { ReactNode } from 'react'

const SHOWN = 8

interface Props {
  diff: PlanDiff
  /** The plan the added and changed events are in, and the one the removed events were in: for their colors */
  after: Plan
  before: Plan
  /** Headings of the three groups, each given the number of events in it */
  labels: { added: (count: number) => string; removed: (count: number) => string; changed: (count: number) => string }
}

const colorOf = (p: Plan, id: string) => p.calendars.find((c) => c.id === id)?.color
/** The day and hours of an event, as a row of a change list shows them. */
export const slotText = (e: PlanEvent) =>
  `${fmtDay(parseLocal(e.start))} ${hm(parseLocal(e.start))}–${hm(parseLocal(e.end))}`

/** The one thing worth saying about a change, the most visible first. */
export function changeText(was: PlanEvent, now: PlanEvent): string {
  const fields = changedFields(was, now)
  if (fields.includes('start') || fields.includes('end')) return `${slotText(was)} → ${slotText(now)}`
  if (fields.includes('title')) return was.title
  if (fields.includes('done')) return now.done ? m.diff_done() : m.diff_not_done()
  if (fields.includes('unfinished') && now.unfinished) return m.diff_unfinished()
  if (fields.includes('actual') && now.actual !== undefined)
    return m.grid_took({ time: fmtDuration((now.actual / 60) * HOUR) })
  const skipped = (now.skip ?? []).filter((day) => !(was.skip ?? []).includes(day))
  if (skipped.length) return m.diff_skipped({ days: skipped.map((day) => fmtDay(parseLocal(day))).join(', ') })
  return m.diff_details()
}

/** The events one plan adds, removes and changes compared with another, as three folding groups. */
export function PlanDiffList({ diff, after, before, labels }: Props) {
  return (
    <div className="grid gap-2">
      <Group tone="text-done-ink" sign="+" label={labels.added(diff.added.length)} count={diff.added.length}>
        {diff.added.slice(0, SHOWN).map((e) => (
          <Row key={e.uid} color={colorOf(after, e.calendar)} title={e.title} detail={slotText(e)} />
        ))}
      </Group>
      <Group tone="text-today-ink" sign="−" label={labels.removed(diff.removed.length)} count={diff.removed.length}>
        {diff.removed.slice(0, SHOWN).map((e) => (
          <Row key={e.uid} color={colorOf(before, e.calendar)} title={e.title} detail={slotText(e)} />
        ))}
      </Group>
      <Group tone="text-focus" sign="~" label={labels.changed(diff.changed.length)} count={diff.changed.length}>
        {diff.changed.slice(0, SHOWN).map(({ before: was, after: now }) => (
          <Row key={now.uid} color={colorOf(after, now.calendar)} title={now.title} detail={changeText(was, now)} />
        ))}
      </Group>
    </div>
  )
}

interface GroupProps {
  tone: string
  sign: string
  label: string
  count: number
  children: ReactNode
}

function Group({ tone, sign, label, count, children }: GroupProps) {
  if (!count) return null
  return (
    <details className="rounded-xl border border-line-soft px-3 py-2" open={count <= SHOWN}>
      <summary className="cursor-pointer text-[13.5px] font-medium">
        <b className={`mr-1.5 inline-block w-3 text-center ${tone}`}>{sign}</b>
        {label}
      </summary>
      <ul className="mt-2 grid gap-1 text-[13px]">{children}</ul>
      {count > SHOWN && <p className="mt-1.5 text-[12.5px] text-muted">{m.and_more({ count: count - SHOWN })}</p>}
    </details>
  )
}

function Row({ color, title, detail }: { color: string | undefined; title: string; detail: string }) {
  return (
    <li className="flex items-baseline gap-2" style={calendarColor(color)}>
      <Dot className="size-2 -translate-y-px" />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <em className="flex-none text-[12.5px] text-muted not-italic tabular-nums">{detail}</em>
    </li>
  )
}
