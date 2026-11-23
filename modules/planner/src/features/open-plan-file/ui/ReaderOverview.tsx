import { fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { diffPlans, HOUR, parseLocal, type Plan } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'
import type { ReactNode } from 'react'

import { PlanDiffList } from './PlanDiffList'

interface Props {
  plan: Plan
  /** The plan to compare with; null when the document is the plan on screen itself */
  compareWith: Plan | null
  /** What that plan is, for the heading: `the previous version`. The plan on screen when left out */
  compareName?: string | undefined
}

/** What a plan document holds and, for a file from disk, how it differs from the project plan. */
export function ReaderOverview({ plan, compareWith, compareName }: Props) {
  const current = compareWith ?? plan
  const diff = diffPlans(current, plan)
  const same = !diff.added.length && !diff.removed.length && !diff.changed.length
  const hours = plan.events.reduce(
    (sum, e) => (e.rrule || e.allDay ? sum : sum + (parseLocal(e.end) - parseLocal(e.start)) / HOUR),
    0,
  )
  const first = plan.events.reduce((min, e) => (e.start < min ? e.start : min), '9999')

  return (
    <>
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={m.stat_events()} value={plan.events.length} />
        <Stat label={m.calendars()} value={plan.calendars.length} />
        <Stat label={m.stat_hours()} value={fmtHours(hours)} />
        <Stat
          label={m.stat_range()}
          value={plan.events.length ? `${fmtDay(parseLocal(first))} – ${fmtDay(parseLocal(plan.meta.planEnd))}` : '—'}
          small
        />
      </dl>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {plan.calendars.map((c) => (
          <li
            key={c.id}
            className="inline-flex items-center gap-[7px] rounded-full border border-line px-2.5 py-[3px] text-[12.5px]"
            style={calendarColor(c.color)}
          >
            <Dot className="size-2" />
            {c.name}
            <em className="text-muted not-italic tabular-nums">
              {plan.events.filter((e) => e.calendar === c.id).length}
            </em>
          </li>
        ))}
      </ul>

      <h4 className="mt-5 mb-2 text-[14px] font-semibold">
        {compareName ? m.lib_compare_with({ name: compareName }) : m.file_compare()}
      </h4>
      {!compareWith ? (
        <p className="text-[13.5px] text-muted">{m.reader_is_project()}</p>
      ) : same ? (
        <p className="text-[13.5px] text-muted">{m.file_same()}</p>
      ) : (
        <PlanDiffList
          diff={diff}
          after={plan}
          before={current}
          labels={{
            added: (count) => m.file_added({ count }),
            removed: (count) => m.file_removed({ count }),
            changed: (count) => m.file_changed({ count }),
          }}
        />
      )}
    </>
  )
}

function Stat({ label, value, small = false }: { label: string; value: ReactNode; small?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`font-semibold tabular-nums ${small ? 'text-[13.5px]/[1.5]' : 'font-display text-[20px]/[1.3]'}`}>
        {value}
      </dd>
    </div>
  )
}
