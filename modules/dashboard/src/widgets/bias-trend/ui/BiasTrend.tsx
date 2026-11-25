import { fmtFactor, fmtRatio } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  MIN_LOGGED,
  accuracyOf,
  isSession,
  runningTypical,
  type Plan,
  type PlanCalendar,
  type TypicalAt,
} from '@lc/plan-domain'
import { calendarColor, Dot, Hint } from '@lc/ui'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { logDomain, logScale, ratioTicks, stepIndex, useWidth } from '../../../shared/lib'
import { Card, ChartTip, LegendKey, type Tip } from '../../../shared/ui'
import { countTicks } from '../model/trend'

const HEIGHT = 150
// The right padding holds the label at the end of the line.
const PAD = { above: 10, right: 46, bottom: 22, left: 40 }
const BAND = 'color-mix(in oklab, var(--ink) 14%, transparent)'
const PLAN = 'color-mix(in oklab, var(--ink) 60%, transparent)'

interface Panel {
  calendar: PlanCalendar
  logged: number
  points: TypicalAt[]
}

function panelsOf(plan: Plan): Panel[] {
  return plan.calendars.flatMap((calendar) => {
    const sessions = plan.events.filter((e) => e.calendar === calendar.id && isSession(e))
    const { logged } = accuracyOf(sessions)
    return logged ? [{ calendar, logged, points: runningTypical(sessions) }] : []
  })
}

function summary({ logged, points }: Panel): string {
  const first = points.at(0)
  const last = points.at(-1)
  if (!first || !last) return m.dash_strip_n_wait({ count: logged, min: MIN_LOGGED })
  const now = m.dash_strip_n_typical({ count: logged, ratio: fmtRatio(last.typical.ratio) })
  return first === last
    ? now
    : `${now} · ${m.dash_trend_from({ count: first.count, ratio: fmtFactor(first.typical.ratio) })}`
}

const range = ({ low, high }: TypicalAt['typical']) => `${fmtFactor(low)}–${fmtFactor(high)}`

interface PanelProps {
  panel: Panel
  /** The log domain every panel shares */
  lo: number
  hi: number
  /** The last session number on every panel's axis */
  last: number
}

function TrendPanel({ panel, lo, hi, last }: PanelProps) {
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)
  const [hover, setHover] = useState<TypicalAt | null>(null)
  const { calendar, logged, points } = panel
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const x = (count: number) => PAD.left + ((count - MIN_LOGGED) / (last - MIN_LOGGED)) * plotW
  const y = logScale(lo, hi, HEIGHT - PAD.bottom, PAD.above)
  const line = (pick: (point: TypicalAt) => number, list = points) =>
    list.map((point, i) => `${i ? 'L' : 'M'}${x(point.count).toFixed(1)},${y(pick(point)).toFixed(1)}`).join('')
  const end = points.at(-1)
  const text = summary(panel)

  function pointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!plotW || !points.length) return
    const px = e.clientX - e.currentTarget.getBoundingClientRect().x
    const count = Math.round(MIN_LOGGED + ((px - PAD.left) / plotW) * (last - MIN_LOGGED))
    setHover(points[Math.max(0, Math.min(points.length - 1, count - MIN_LOGGED))] ?? null)
  }

  function keyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'Escape') {
      setHover(null)
      return
    }
    const next = stepIndex(e.key, hover ? points.indexOf(hover) : points.length - 1, points.length)
    if (next === null) return
    e.preventDefault()
    setHover(points[next] ?? null)
  }

  const tip: Tip | null = hover && {
    x: x(hover.count),
    title: `${calendar.name} · n ${hover.count}`,
    rows: [
      { label: m.dash_strip_typical_label(), value: fmtRatio(hover.typical.ratio) },
      { label: m.dash_strip_interval_label(), value: range(hover.typical) },
    ],
  }

  return (
    <div className="min-w-0" style={calendarColor(calendar.color)}>
      <div className="text-[13px]/[1.35]">
        <span className="flex items-baseline gap-2">
          <Dot className="size-2.5 flex-none -translate-y-px" />
          <b className="truncate font-semibold">{calendar.name}</b>
        </span>
        <span className="block text-[12px] text-muted tabular-nums">{text}</span>
      </div>
      <div ref={box} className="relative mt-1.5" style={{ height: HEIGHT }}>
        {!end ? (
          <p className="grid h-full place-items-center rounded-xl border border-dashed border-line px-4 text-center text-[12.5px] text-muted">
            {m.dash_trend_wait({ min: MIN_LOGGED, left: MIN_LOGGED - logged })}
          </p>
        ) : (
          width > 0 && (
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the keys walk the readout along the line, as the pointer does
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={`${calendar.name}: ${text}`}
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a chart read with the arrows has to take focus
              tabIndex={0}
              className="block touch-pan-y rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              onPointerMove={pointerMove}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover((shown) => shown ?? end)}
              onBlur={() => setHover(null)}
              onKeyDown={keyDown}
            >
              {ratioTicks(lo, hi).map((tick) => (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke={tick === 1 ? PLAN : 'var(--line-soft)'}
                    strokeWidth={tick === 1 ? 1.5 : 1}
                  />
                  <text
                    x={PAD.left - 6}
                    y={y(tick) + 4}
                    textAnchor="end"
                    className={`text-[11px] tabular-nums ${tick === 1 ? 'fill-ink font-semibold' : 'fill-muted'}`}
                  >
                    {fmtFactor(tick)}
                  </text>
                </g>
              ))}
              {countTicks(MIN_LOGGED, last, Math.floor(plotW / 40)).map((count) => (
                <text
                  key={count}
                  x={x(count)}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  className="fill-muted text-[11px] tabular-nums"
                >
                  {count}
                </text>
              ))}
              {points.length > 1 ? (
                <path
                  d={`${line((point) => point.typical.high)}${line((point) => point.typical.low, points.toReversed()).replace('M', 'L')}Z`}
                  fill={BAND}
                />
              ) : (
                <rect
                  x={x(end.count) - 3}
                  y={y(end.typical.high)}
                  width={6}
                  height={Math.max(6, y(end.typical.low) - y(end.typical.high))}
                  rx={3}
                  fill={BAND}
                />
              )}
              <path
                d={line((point) => point.typical.ratio)}
                fill="none"
                stroke="var(--c)"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {hover && (
                <line
                  x1={x(hover.count)}
                  x2={x(hover.count)}
                  y1={PAD.above}
                  y2={HEIGHT - PAD.bottom}
                  stroke="var(--line)"
                />
              )}
              {[hover ?? end].map((point) => (
                <circle
                  key={point.count}
                  cx={x(point.count)}
                  cy={y(point.typical.ratio)}
                  r={4}
                  fill="var(--c)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ))}
              {!hover && (
                <text
                  x={x(end.count) + 8}
                  y={y(end.typical.ratio) + 4}
                  className="fill-ink text-[11.5px] font-semibold tabular-nums"
                >
                  {fmtFactor(end.typical.ratio)}
                </text>
              )}
            </svg>
          )
        )}
        <ChartTip tip={tip} width={width} />
      </div>
    </div>
  )
}

/**
 * The typical session of each course after each logged session, from the `MIN_LOGGED`th on, with its 95% interval:
 * one small panel per course, all on the same axes, so a band that narrows and a line that drifts from ×1 compare.
 */
export function BiasTrend({ plan }: { plan: Plan }) {
  const panels = panelsOf(plan)
  const typicals = panels.flatMap((panel) => panel.points.map((point) => point.typical))
  const { lo, hi } = logDomain(typicals.flatMap((typical) => [typical.low, typical.high]))
  const last = Math.max(MIN_LOGGED + 1, ...panels.map((panel) => panel.points.at(-1)?.count ?? 0))

  return (
    <Card
      title={m.dash_trend_title()}
      hint={m.dash_trend_hint()}
      help={<Hint title={m.help_trend_title()} text={m.help_trend()} />}
      aside={
        typicals.length > 0 && (
          <span className="flex min-w-0 flex-wrap gap-x-3.5 gap-y-1">
            <LegendKey shape="line" color="var(--muted)" label={m.dash_strip_typical_label()} />
            <LegendKey color={BAND} label={m.dash_strip_interval_label()} />
            <LegendKey shape="line" color={PLAN} label={m.dash_strip_plan()} />
          </span>
        )
      }
    >
      {panels.length === 0 ? (
        <p className="text-[13px] text-muted">{m.dash_trend_none({ min: MIN_LOGGED })}</p>
      ) : (
        <>
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {panels.map((panel) => (
              <TrendPanel key={panel.calendar.id} panel={panel} lo={lo} hi={hi} last={last} />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">{m.dash_trend_axis()}</p>
          {typicals.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[13px] font-semibold">{m.dash_trend_table()}</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-[13px] tabular-nums">
                  <thead>
                    <tr className="border-b border-line text-left text-muted">
                      {[m.dash_strip_logged(), m.dash_trend_typical(), m.dash_trend_interval()].map((label, i) => (
                        <th key={label} scope="col" className={`py-1.5 font-medium ${i ? 'pl-3 text-right' : 'pr-3'}`}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {panels.map((panel) => (
                    <tbody key={panel.calendar.id}>
                      <tr className="border-b border-line-soft">
                        <th scope="rowgroup" colSpan={3} className="pt-2.5 pb-1 text-left font-semibold">
                          {panel.calendar.name} · <span className="font-normal text-muted">{summary(panel)}</span>
                        </th>
                      </tr>
                      {panel.points.map((point) => (
                        <tr key={point.count} className="border-b border-line-soft last:border-b-0">
                          <td className="py-1.5 pr-3">{point.count}</td>
                          <td className="py-1.5 pl-3 text-right whitespace-nowrap">{fmtRatio(point.typical.ratio)}</td>
                          <td className="py-1.5 pl-3 text-right whitespace-nowrap">{range(point.typical)}</td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </Card>
  )
}
