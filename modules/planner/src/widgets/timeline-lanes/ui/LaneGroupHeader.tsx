import { fmtDay, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import type { CalendarLane, LabelGroup } from '@lc/plan-domain'
import { Tag } from '@lc/ui'

import { dayMs } from '../lib/scale'

interface Props {
  group: LabelGroup<CalendarLane>
  /** `YYYY-MM-DD`; '' before the clock is known, when every deadline is ahead */
  today: string
}

/** The row over the lanes of one label: how many courses and sessions are left, their span and the nearest deadline. */
export function LaneGroupHeader({ group, today }: Props) {
  const lanes = group.items
  const left = lanes.reduce((sum, lane) => sum + lane.total - lane.done, 0)
  const first = lanes.map((lane) => lane.first).toSorted()[0]
  const last = lanes
    .map((lane) => lane.last)
    .toSorted()
    .at(-1)
  const deadline = lanes
    .flatMap((lane) => (lane.deadline !== null && lane.deadline >= today ? [lane.deadline] : []))
    .toSorted()[0]
  const facts = [
    m.courses_count({ count: lanes.length }),
    m.sessions_left({ count: left }),
    ...(first && last ? [`${fmtShort(dayMs(first))} – ${fmtShort(dayMs(last))}`] : []),
    ...(deadline ? [m.deadline_on({ date: fmtDay(dayMs(deadline)) })] : []),
  ]
  return (
    // As wide as the days; the text keeps to the left edge of the view while the days scroll under it.
    <div className="col-span-2 border-b border-line-soft bg-surface-2">
      <div className="sticky left-0 inline-flex items-baseline gap-x-2.5 px-3 pt-2.5 pb-1.5 whitespace-nowrap md:px-4">
        <span className="flex items-center gap-1.5 self-center text-[13px] font-semibold">
          <Tag size={13} aria-hidden className="text-muted" />
          {group.label ?? m.label_none()}
        </span>
        <span className="text-[12px] text-muted tabular-nums">{facts.join(' · ')}</span>
      </div>
    </div>
  )
}
