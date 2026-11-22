import { fmtHours, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, type PlanStats } from '@lc/plan-domain'
import { useRef, useState, type PointerEvent } from 'react'

import { niceTicks, useWidth } from '../../../shared/lib'
import { Card, ChartTip, LegendKey, type Tip } from '../../../shared/ui'

const HEIGHT = 260
const PAD = { above: 16, right: 16, bottom: 26, left: 40 }
const WEEK = 7 * DAY

interface Props {
  /** `planStats(plan, now)`: the page computes it once for all its widgets */
  stats: PlanStats
  /** Wall-clock ms; null before the clock is known */
  now: number | null
  /** The day the rest runs out at the real pace (`paceForecast`), wall-clock ms: drawn as a dashed line */
  forecast?: number | null
}

/** Hours over time, added up: the plan as a line to the total, and what is done so far climbing toward it. */
export function BurnUp({ stats, now, forecast = null }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)
  const [hover, setHover] = useState<number | null>(null)
  const { weeks } = stats

  // Point i is the end of week i - 1; point 0 is the start of the plan.
  const planned = [0]
  const done = [0]
  for (const week of weeks) {
    planned.push(planned.at(-1)! + week.planned)
    done.push(done.at(-1)! + week.done)
  }
  const start = weeks[0]?.monday ?? 0
  const elapsed = now === null ? 0 : Math.max(0, Math.min(weeks.length, (now - start) / WEEK))
  // The done line stops at the week that is running: the future has nothing to show yet.
  const doneUntil = Math.min(weeks.length, Math.ceil(elapsed))

  // The forecast may end after the plan: the time axis then runs on to it.
  const forecastAt = forecast === null || !weeks.length ? null : (forecast + DAY - start) / WEEK
  const span = Math.max(weeks.length, Math.ceil(forecastAt ?? 0))
  const ticks = niceTicks(stats.planned)
  const peak = ticks.at(-1) ?? 1
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.above - PAD.bottom
  const x = (i: number) => PAD.left + (span ? (i / span) * plotW : 0)
  const y = (hours: number) => PAD.above + plotH - (hours / peak) * plotH
  const path = (values: number[]) =>
    values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const every = Math.max(1, Math.ceil(span / Math.max(1, Math.floor(plotW / 64))))

  function pointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!plotW || !weeks.length) return
    const px = e.clientX - e.currentTarget.getBoundingClientRect().x
    setHover(Math.max(0, Math.min(weeks.length, Math.round(((px - PAD.left) / plotW) * span))))
  }

  const tip: Tip | null =
    hover === null
      ? null
      : {
          x: x(hover),
          title: fmtShort(start + hover * WEEK),
          rows: [
            { color: 'var(--muted)', label: m.dash_planned(), value: fmtHours(planned[hover]) },
            ...(hover <= doneUntil
              ? [{ color: 'var(--done)', label: m.dash_done(), value: fmtHours(done[hover]) }]
              : []),
          ],
        }

  return (
    <Card
      title={m.dash_burnup()}
      hint={m.dash_burnup_hint()}
      aside={
        <span className="flex gap-3.5">
          <LegendKey shape="line" color="var(--muted)" label={m.dash_planned()} />
          <LegendKey shape="line" color="var(--done)" label={m.dash_done()} />
          {forecastAt !== null && <LegendKey shape="line" color="var(--focus)" label={m.dash_forecast_real()} />}
        </span>
      }
    >
      <div ref={box} className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={m.dash_burnup()}
            className="block touch-pan-y"
            onPointerMove={pointerMove}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--line-soft)" />
                <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                  {tick}
                </text>
              </g>
            ))}
            {weeks.map((week, i) =>
              i % every ? null : (
                <text key={week.monday} x={x(i)} y={HEIGHT - 6} textAnchor="middle" className="fill-muted text-[11px]">
                  {fmtShort(week.monday)}
                </text>
              ),
            )}
            {now !== null && elapsed > 0 && elapsed < weeks.length && (
              <g>
                <line x1={x(elapsed)} x2={x(elapsed)} y1={PAD.above} y2={PAD.above + plotH} stroke="var(--today)" />
                <text x={x(elapsed) + 5} y={PAD.above + 10} className="fill-muted text-[11px]">
                  {m.dash_today()}
                </text>
              </g>
            )}
            <path d={path(planned)} fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinejoin="round" />
            {doneUntil > 0 && (
              <>
                <path
                  d={`${path(done.slice(0, doneUntil + 1))}L${x(doneUntil).toFixed(1)},${y(0)}L${x(0)},${y(0)}Z`}
                  fill="var(--done)"
                  opacity={0.12}
                />
                <path
                  d={path(done.slice(0, doneUntil + 1))}
                  fill="none"
                  stroke="var(--done)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                <circle
                  cx={x(doneUntil)}
                  cy={y(done[doneUntil])}
                  r={4}
                  fill="var(--done)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              </>
            )}
            {forecastAt !== null && forecastAt > elapsed && stats.done < stats.planned && (
              <g>
                <line
                  x1={x(elapsed)}
                  y1={y(stats.done)}
                  x2={x(forecastAt)}
                  y2={y(stats.planned)}
                  stroke="var(--focus)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
                <text
                  x={x(forecastAt) - 6}
                  y={y(stats.planned) + 16}
                  textAnchor="end"
                  className="fill-muted text-[11px]"
                >
                  {fmtShort(forecast ?? 0)}
                </text>
              </g>
            )}
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1={PAD.above} y2={PAD.above + plotH} stroke="var(--line)" />
            )}
          </svg>
        )}
        <ChartTip tip={tip} width={width} />
      </div>
    </Card>
  )
}
