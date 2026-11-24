import { fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, countdown, parseLocal, startOfDay, type Plan, type PlanStats } from '@lc/plan-domain'
import { calendarColor, ProgressRing } from '@lc/ui'
import type { ReactNode } from 'react'

interface Props {
  plan: Plan
  /** `planStats(plan, now)`: the page computes it once for all its widgets */
  stats: PlanStats
  /** Wall-clock ms; null before the clock is known */
  now: number | null
}

/** The headline numbers: how much is done, whether that is on pace, and how much time is left. */
export function StatTiles({ plan, stats, now }: Props) {
  const share = stats.planned ? stats.done / stats.planned : 0
  const lead = stats.done - stats.plannedByNow
  const target = now === null ? null : countdown(plan, now)
  const deadline = target?.day ? parseLocal(`${target.day}T00:00`) : null
  const daysLeft = now === null || deadline === null ? null : Math.ceil((deadline - startOfDay(now)) / DAY)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Tile label={m.dash_progress()} className="col-span-2 lg:col-span-1">
        <span className="flex items-center gap-3">
          <span style={calendarColor('var(--done)')}>
            <ProgressRing value={share} size={46} label={m.dash_progress()} />
          </span>
          <b className="font-display text-[26px]/[1.1] font-semibold tabular-nums">{Math.round(share * 100)}%</b>
        </span>
      </Tile>
      <Tile label={m.dash_hours()} note={m.dash_of({ total: fmtHours(stats.planned) })}>
        {fmtHours(stats.done)}
      </Tile>
      <Tile label={m.dash_sessions()} note={m.dash_of({ total: stats.sessions })}>
        {stats.doneSessions}
      </Tile>
      <Tile
        label={m.dash_pace()}
        note={
          Math.abs(lead) < 0.25
            ? m.dash_on_track()
            : lead > 0
              ? m.dash_ahead({ hours: fmtHours(stats.plannedByNow) })
              : m.dash_behind({ hours: fmtHours(stats.plannedByNow) })
        }
      >
        {/* The arrow and the sign carry the meaning; the color only repeats it. */}
        <span className={Math.abs(lead) < 0.25 ? '' : lead > 0 ? 'text-done-ink' : 'text-today-ink'}>
          {Math.abs(lead) < 0.25 ? '✓' : lead > 0 ? '▲ +' : '▼ −'}
          {Math.abs(lead) < 0.25 ? '' : fmtHours(Math.abs(lead))}
        </span>
      </Tile>
      <Tile
        label={m.dash_deadline()}
        note={
          stats.forecast !== null
            ? m.dash_forecast({ date: fmtDay(stats.forecast) })
            : deadline !== null
              ? fmtDay(deadline)
              : undefined
        }
      >
        {daysLeft === null ? '—' : m.dash_days({ count: Math.max(0, daysLeft) })}
      </Tile>
    </div>
  )
}

function Tile({
  label,
  note,
  className = '',
  children,
}: {
  label: string
  note?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`min-w-0 rounded-2xl border border-line bg-surface px-4 py-3.5 ${className}`}>
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="mt-1 font-display text-[22px]/[1.2] font-semibold tabular-nums">{children}</div>
      {note && <div className="mt-1 truncate text-[12.5px] text-muted">{note}</div>}
    </div>
  )
}
