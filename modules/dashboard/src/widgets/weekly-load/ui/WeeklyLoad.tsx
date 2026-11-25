import { fmtHours, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, type Plan, type PlanCalendar, type PlanStats } from '@lc/plan-domain'
import { Hint } from '@lc/ui'
import { useRef, useState } from 'react'

import { niceTicks, useWidth } from '../../../shared/lib'
import { Card, ChartTip, LegendKey, type Tip } from '../../../shared/ui'

const HEIGHT = 240
const PAD = { above: 16, right: 16, bottom: 26, left: 40 }
const MAX_BAR = 24
/** Surface-colored gap between the segments of one bar, px */
const GAP = 2

interface Props {
  plan: Plan
  /** `planStats(plan, now)`: the page computes it once for all its widgets */
  stats: PlanStats
  /** Wall-clock ms; null before the clock is known */
  now: number | null
  /** Splits the bars by label instead of by calendar */
  byLabel?: boolean | undefined
}

/** One part of a bar: a calendar, or every calendar whose first label is the same */
interface Series {
  key: string
  name: string
  color: string
  ids: string[]
}

/**
 * By label, a calendar counts under its first label only: a stacked bar that counted it twice would rise over the
 * hours the week really has. A label takes the color of its first calendar.
 */
function seriesOf(calendars: PlanCalendar[], byLabel: boolean): Series[] {
  if (!byLabel) return calendars.map((c) => ({ key: c.id, name: c.name, color: c.color, ids: [c.id] }))
  const series: Series[] = []
  for (const c of calendars) {
    const [label = null] = c.labels ?? []
    const key = label === null ? '' : `label:${label.toLocaleLowerCase()}`
    const known = series.find((one) => one.key === key)
    if (known) known.ids.push(c.id)
    else series.push({ key, name: label ?? m.label_none(), color: c.color, ids: [c.id] })
  }
  return series
}

const hoursOf = (byCalendar: Record<string, number>, ids: string[]) =>
  ids.reduce((sum, id) => sum + (byCalendar[id] ?? 0), 0)

/** Planned hours of every week, split by calendar or by label, against the weekly budget. */
export function WeeklyLoad({ plan, stats, now, byLabel = false }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)
  const [hover, setHover] = useState<number | null>(null)
  const { weeks } = stats
  const budget = plan.meta.weeklyBudgetHours
  // A calendar keeps its own color whatever the others are: the legend lists only the ones that have hours.
  const calendars = seriesOf(
    plan.calendars.filter((c) => weeks.some((w) => w.byCalendar[c.id])),
    byLabel,
  )

  const ticks = niceTicks(Math.max(budget, ...weeks.map((w) => w.planned)))
  const peak = ticks.at(-1) ?? 1
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.above - PAD.bottom
  const band = weeks.length ? plotW / weeks.length : 0
  const bar = Math.min(MAX_BAR, Math.max(2, band - 6))
  const y = (hours: number) => PAD.above + plotH - (hours / peak) * plotH
  const center = (i: number) => PAD.left + band * (i + 0.5)
  const every = Math.max(1, Math.ceil(weeks.length / Math.max(1, Math.floor(plotW / 64))))

  const hovered = hover === null ? null : weeks[hover]
  const tip: Tip | null =
    hover === null || !hovered
      ? null
      : {
          x: center(hover),
          title: `${fmtShort(hovered.monday)} – ${fmtShort(hovered.monday + 6 * DAY)}`,
          rows: [
            ...calendars.flatMap((c) => {
              const hours = hoursOf(hovered.byCalendar, c.ids)
              return hours ? [{ color: c.color, label: c.name, value: fmtHours(hours) }] : []
            }),
            { label: m.dash_planned(), value: fmtHours(hovered.planned) },
            { label: m.dash_done(), value: fmtHours(hovered.done) },
          ],
        }

  return (
    <Card
      title={m.dash_weekly()}
      hint={`${m.dash_weekly_hint({ hours: fmtHours(budget) })}${byLabel ? ` ${m.dash_first_label()}` : ''}`}
      help={<Hint title={m.help_weekly_title()} text={m.help_weekly()} />}
      aside={
        <span className="flex min-w-0 flex-wrap gap-x-3.5 gap-y-1">
          {calendars.map((c) => (
            <LegendKey key={c.key} color={c.color} label={c.name} />
          ))}
        </span>
      }
    >
      <div ref={box} className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={m.dash_weekly()} className="block">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--line-soft)" />
                <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                  {tick}
                </text>
              </g>
            ))}
            {weeks.map((week, i) => {
              let from = 0
              const current = now !== null && now >= week.monday && now < week.monday + 7 * DAY
              const segments = calendars.flatMap((calendar) => {
                const hours = hoursOf(week.byCalendar, calendar.ids)
                return hours ? [{ calendar, hours }] : []
              })
              return (
                <g key={week.monday}>
                  {hover === i && (
                    <rect x={PAD.left + band * i} y={PAD.above} width={band} height={plotH} fill="var(--surface-2)" />
                  )}
                  {segments.map(({ calendar: c, hours }, index) => {
                    const bottom = y(from)
                    from += hours
                    const last = index === segments.length - 1
                    const height = Math.max(1, bottom - y(from) - (last ? 0 : GAP))
                    const left = center(i) - bar / 2
                    const r = last ? Math.min(4, height, bar / 2) : 0
                    return (
                      <path
                        key={c.key}
                        fill={c.color}
                        // Rounded at the data end only; the baseline side stays square.
                        d={`M${left},${bottom}V${bottom - height + r}q0,${-r} ${r},${-r}h${bar - 2 * r}q${r},0 ${r},${r}V${bottom}Z`}
                      />
                    )
                  })}
                  {i % every === 0 && (
                    <text
                      x={center(i)}
                      y={HEIGHT - 6}
                      textAnchor="middle"
                      className={`text-[11px] ${current ? 'fill-ink font-semibold' : 'fill-muted'}`}
                    >
                      {fmtShort(week.monday)}
                    </text>
                  )}
                  {/* The whole band is the hit target, not only the thin bar. */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.above}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover((shown) => (shown === i ? null : shown))}
                  />
                </g>
              )
            })}
            <line x1={PAD.left} x2={width - PAD.right} y1={y(budget)} y2={y(budget)} stroke="var(--today)" />
            <text x={width - PAD.right} y={y(budget) - 5} textAnchor="end" className="fill-muted text-[11px]">
              {m.dash_budget({ hours: fmtHours(budget) })}
            </text>
          </svg>
        )}
        <ChartTip tip={tip} width={width} />
      </div>
    </Card>
  )
}
