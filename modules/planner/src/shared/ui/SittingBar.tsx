import { m } from '@lc/i18n/messages'
import { groupBar, type BarSegment, type GroupBar, type SessionGroup } from '@lc/plan-domain'
import { Link2 } from '@lc/ui'

const SEGMENT: Record<BarSegment['kind'], string> = {
  done: 'bg-[color-mix(in_srgb,var(--c)_55%,var(--surface))]',
  booked:
    'bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--c)_45%,var(--surface))_0_2px,var(--surface)_2px_5px)]',
  rest: 'border border-dashed border-[color-mix(in_srgb,var(--c)_60%,var(--surface))]',
}
const OVERRUN =
  'pointer-events-none absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--c)_14%,transparent)_0_4px,transparent_4px_8px)]'

/** The label a screen reader hears for a group's bar, and the text that sits beside it. */
export function sittingLabel(group: SessionGroup): string {
  const progress = m.sitting_progress({ done: group.doneMinutes, total: groupBar(group).total })
  if (group.doneMinutes <= group.firstPlan) return progress
  return `${progress}, ${m.sitting_over({ minutes: group.doneMinutes - group.firstPlan })}`
}

interface Props {
  bar: GroupBar
  /** The sitting the page is about: its done stretch is drawn in the full colour */
  current?: string | undefined
  size: 'strip' | 'bar'
  /** `sittingLabel` of the group: the bar alone cannot say how many minutes are done or over */
  label: string
}

/**
 * The sittings of a session as one bar, a stretch for each, as long as its minutes. Its colour is the inherited
 * `--c`: the caller sets it with `calendarColor`.
 */
export function SittingBar({ bar, current, size, label }: Props) {
  const shape = size === 'strip' ? 'h-1' : 'h-1.5 rounded-full'
  return (
    <div role="img" aria-label={label} className={`relative flex gap-px overflow-hidden ${shape}`}>
      {bar.segments.map((s, i) => (
        <span
          key={`${s.kind}-${s.uid ?? i}`}
          className={`${SEGMENT[s.kind]} ${s.kind === 'done' && s.uid === current ? 'bg-(--c)' : ''}`}
          style={{ flexGrow: s.minutes, flexBasis: 0 }}
        />
      ))}
      {bar.tick !== null && (
        <>
          <span className={OVERRUN} style={{ left: `${(bar.tick / bar.total) * 100}%` }} />
          <span
            className="pointer-events-none absolute inset-y-0 w-px bg-ink"
            style={{ left: `${(bar.tick / bar.total) * 100}%` }}
          />
        </>
      )}
    </div>
  )
}

/** The mark of a sitting that is one of several of its session. */
export function PartMark({ index, count }: { index: number; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted">
      <Link2 aria-hidden size={12} />
      {m.sitting_part({ index, count })}
    </span>
  )
}
