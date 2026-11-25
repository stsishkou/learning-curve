import { dowShort, fmtDay, fmtHours, fmtMonthName } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, startOfDay, studyStreak, type Plan, type StudyDay } from '@lc/plan-domain'
import { Flame } from '@lc/ui'

import { Card, LegendKey } from '../../../shared/ui'

interface Props {
  plan: Plan
  /** Wall-clock ms; null before the clock is known */
  now: number | null
}

const DONE: readonly [string, string, string] = [
  'var(--done)',
  'color-mix(in srgb, var(--done) 70%, var(--surface))',
  'color-mix(in srgb, var(--done) 40%, var(--surface))',
]
const MISSED = 'color-mix(in srgb, var(--today) 45%, var(--surface))'
const AHEAD = 'var(--line)'

/** One hue from light to dark for the share of the day that is done; a missed day and a day ahead have their own. */
function fill(day: StudyDay, today: number | null): string | undefined {
  if (day.planned === 0) return undefined
  if (day.done > 0) return DONE[day.done >= day.planned ? 0 : day.done * 2 >= day.planned ? 1 : 2]
  return today !== null && day.day < today ? MISSED : AHEAD
}

function label(day: StudyDay, today: number | null): string {
  const date = fmtDay(day.day)
  if (day.planned === 0) return date
  const planned = fmtHours(day.planned)
  if (day.done > 0) return m.streak_done({ date, done: fmtHours(day.done), planned })
  return today !== null && day.day < today ? m.streak_missed({ date, planned }) : m.streak_ahead({ date, planned })
}

/**
 * The habit at a glance: the run of study days with something done, and every day of the plan as a cell, a column
 * per week.
 */
export function StudyStreak({ plan, now }: Props) {
  const streak = now === null ? null : studyStreak(plan, now)
  const today = now === null ? null : startOfDay(now)
  const days = streak?.days ?? []
  const weeks = days.flatMap((monday, i) => (i % 7 === 0 ? [{ monday: monday.day, days: days.slice(i, i + 7) }] : []))

  return (
    <Card
      title={m.dash_streak()}
      hint={m.dash_streak_hint()}
      aside={
        <span className="flex min-w-0 flex-wrap gap-x-3.5 gap-y-1">
          <LegendKey color={DONE[0]} label={m.streak_legend_done()} />
          <LegendKey color={MISSED} label={m.streak_legend_missed()} />
          <LegendKey color={AHEAD} label={m.streak_legend_ahead()} />
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-3">
          <Flame size={30} aria-hidden className={streak?.current ? 'text-today' : 'text-muted'} />
          <div>
            <b className="block font-display text-[26px]/[1.1] font-semibold tabular-nums">
              {streak ? m.dash_days({ count: streak.current }) : '—'}
            </b>
            <span className="text-[12.5px] text-muted">
              {streak ? m.dash_streak_best({ days: m.dash_days({ count: streak.best }) }) : ''}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-1">
          <div className="flex w-max gap-[3px]">
            <div className="mt-[18px] mr-1 grid grid-rows-7 gap-[3px] text-[10.5px]/[20px] text-muted" aria-hidden>
              {weeks[0]?.days.map((d, i) => (
                <span key={d.day}>{i % 2 === 0 ? dowShort(d.day) : ''}</span>
              ))}
            </div>
            {weeks.map((week, i) => (
              <div key={week.monday} className="grid gap-[3px]">
                {/* The month is named over the week it starts in. */}
                <span className="h-[15px] text-[10.5px]/[15px] whitespace-nowrap text-muted" aria-hidden>
                  {i === 0 || new Date(week.monday).getUTCMonth() !== new Date(week.monday - 7 * DAY).getUTCMonth()
                    ? fmtMonthName(week.monday).slice(0, 3)
                    : ''}
                </span>
                {week.days.map((d) => (
                  <i
                    key={d.day}
                    role="img"
                    aria-label={label(d, today)}
                    data-tip={label(d, today)}
                    className={`block size-5 rounded-[5px] ${d.planned === 0 ? 'border border-line-soft' : ''} ${d.day === today ? 'outline-2 outline-offset-1 outline-today' : ''}`}
                    style={{ background: fill(d, today) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
