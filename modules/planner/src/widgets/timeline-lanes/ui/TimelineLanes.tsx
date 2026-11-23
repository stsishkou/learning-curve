import { fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { calendarLanes, DAY, lanesRange, type Plan } from '@lc/plan-domain'
import { EyeOff, Hint, Menu } from '@lc/ui'
import { useId, useMemo } from 'react'

import { scaleOf } from '../lib/scale'
import type { TimelinePosition } from '../model/use-timeline-position'
import { LaneRow } from './LaneRow'

interface Props {
  plan: Plan
  /** Calendars the planner's filter hides: they get no lane */
  hidden: ReadonlySet<string>
  /** Minsk wall-clock ms; null before the clock is known, as on the server */
  now: number | null
  position: Exclude<TimelinePosition, 'hidden'>
  onPosition: (next: TimelinePosition) => void
}

// The labels at the ends of the axis step aside for today's own label.
const NEAR_EDGE = 18

/**
 * A thin lane per calendar with sessions ahead: its span from the first to the last session, each session, the spare
 * or late days around its deadline, and one today line. Nothing when no calendar has anything ahead.
 */
export function TimelineLanes({ plan, hidden, now, position, onPosition }: Props) {
  const id = useId()
  const lanes = useMemo(() => calendarLanes(plan, now, hidden), [plan, now, hidden])
  const range = lanesRange(lanes, now)
  if (!range) return null
  const scale = scaleOf(range)
  const today = now === null ? null : scale.at(now)

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mb-4 rounded-2xl border border-line bg-surface px-3.5 pt-2 pb-2.5 md:px-5 print:hidden"
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 id={`${id}-title`} className="text-[13px] font-semibold">
          {m.timeline()}
        </h2>
        <Hint title={m.help_timeline_title()} text={m.help_timeline()} />
        <Menu
          label={m.timeline_position()}
          className="ml-auto"
          items={[
            {
              id: 'below',
              label: m.timeline_below(),
              checked: position === 'below',
              run: () => onPosition('below'),
            },
            {
              id: 'above',
              label: m.timeline_above(),
              checked: position === 'above',
              run: () => onPosition('above'),
            },
            {
              id: 'hide',
              label: m.timeline_hide(),
              icon: <EyeOff size={16} aria-hidden />,
              run: () => onPosition('hidden'),
            },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-y-1 md:grid-cols-[140px_minmax(0,1fr)] md:gap-x-4">
        {lanes.map((lane, i) => (
          <LaneRow key={lane.calendar.id} lane={lane} scale={scale} now={now} first={i === 0} />
        ))}
        <div className="relative h-4 text-[11.5px] text-muted md:col-start-2">
          <span className={`absolute left-0 ${today !== null && today < NEAR_EDGE ? 'invisible' : ''}`}>
            {fmtShort(range.start)}
          </span>
          <span className={`absolute right-0 ${today !== null && today > 100 - NEAR_EDGE ? 'invisible' : ''}`}>
            {fmtShort(range.end - DAY)}
          </span>
          {today !== null && today >= 0 && today <= 100 && (
            <span
              className="absolute -translate-x-1/2 font-semibold whitespace-nowrap text-today-ink"
              style={{ left: `${today}%` }}
            >
              {m.today()}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
