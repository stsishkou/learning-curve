import { fmtDay, fmtDuration, fmtFactor, fmtRatio } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  MIN_LOGGED,
  accuracyOf,
  isSession,
  parseLocal,
  type Accuracy,
  type EventKind,
  type Plan,
  type PlanCalendar,
  type PlanEvent,
} from '@lc/plan-domain'
import { calendarColor, Dot, Hint } from '@lc/ui'
import { Fragment, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { logDomain, logScale, ratioTicks, stepIndex, useWidth } from '../../../shared/lib'
import { Card, ChartTip, type Tip } from '../../../shared/ui'
import { stackSlots } from '../model/strip'

const MINUTE = 60_000
/** Radius of a mark: 8px across, as the dots of every chart here */
const R = 4
/** Rows apart of stacked marks, px */
const STEP = 9
const ROW_MIN = 34
const PAD_X = 12
const AXIS = 22

interface Mark {
  event: PlanEvent
  ratio: number
  /** Planned minutes */
  planned: number
  actual: number
}

interface Row {
  calendar: PlanCalendar
  marks: Mark[]
  accuracy: Accuracy
}

/** A place in a row with a readout: a mark or the typical session. */
interface Stop {
  /** The session's uid; absent on the typical session */
  uid?: string | undefined
  x: number
  y: number
  /** Radius of the hit target, wider than what it covers */
  r: number
  tip: Tip
}

type Shape = 'circle' | 'triangle' | 'square'
const SHAPES: Partial<Record<EventKind, Shape>> = { lab: 'triangle', review: 'square' }
const shapeOf = (kind: EventKind): Shape => SHAPES[kind] ?? 'circle'

/** A mark of the kind's shape, ringed in the surface color so stacked marks stay apart. */
function Glyph({ shape, x, y, fill }: { shape: Shape; x: number; y: number; fill: string }) {
  const ring = { fill, stroke: 'var(--surface)', strokeWidth: 2 }
  if (shape === 'triangle') {
    return (
      <path {...ring} d={`M${x},${y - R * 1.25}L${x + R * 1.15},${y + R * 0.85}L${x - R * 1.15},${y + R * 0.85}Z`} />
    )
  }
  if (shape === 'square') return <rect {...ring} x={x - R + 0.5} y={y - R + 0.5} width={2 * R - 1} height={2 * R - 1} />
  return <circle {...ring} cx={x} cy={y} r={R} />
}

/** A legend entry drawn as the chart draws it; the text stays in ink. */
function Key({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] whitespace-nowrap text-muted">
      <svg aria-hidden width={14} height={12} viewBox="-7 -6 14 12">
        {children}
      </svg>
      {label}
    </span>
  )
}

function rowsOf(plan: Plan): Row[] {
  return plan.calendars.flatMap((calendar) => {
    const sessions = plan.events.filter((e) => e.calendar === calendar.id && isSession(e))
    const marks = sessions
      .flatMap((event) => {
        const planned = (parseLocal(event.end) - parseLocal(event.start)) / MINUTE
        return event.done && event.actual !== undefined && planned > 0
          ? [{ event, ratio: event.actual / planned, planned, actual: event.actual }]
          : []
      })
      .toSorted((a, b) => a.event.start.localeCompare(b.event.start))
    return marks.length ? [{ calendar, marks, accuracy: accuracyOf(sessions) }] : []
  })
}

/** What a row can show a readout for, left to right, so the pointer and the arrow keys walk the same places. */
function stopsOf(row: Row, x: (ratio: number) => number, xs: number[], slots: number[], mid: number): Stop[] {
  const { typical, logged } = row.accuracy
  const marks = row.marks.map((mark, i): Stop => ({
    uid: mark.event.uid,
    x: xs[i] ?? 0,
    y: mid + (slots[i] ?? 0) * STEP,
    r: R + 4,
    tip: {
      x: xs[i] ?? 0,
      title: mark.event.title,
      rows: [
        { label: fmtDay(parseLocal(mark.event.start)), value: fmtRatio(mark.ratio) },
        {
          label: m.dash_strip_of_planned({ time: fmtDuration(mark.planned * MINUTE) }),
          value: fmtDuration(mark.actual * MINUTE),
        },
      ],
    },
  }))
  const summary: Stop[] = typical
    ? [
        {
          x: x(typical.ratio),
          y: mid,
          r: 9,
          tip: {
            x: x(typical.ratio),
            title: `${row.calendar.name} · n ${logged}`,
            rows: [
              { label: m.dash_strip_typical_label(), value: fmtRatio(typical.ratio) },
              {
                label: m.dash_strip_interval_label(),
                value: `${fmtFactor(typical.low)}–${fmtFactor(typical.high)}`,
              },
            ],
          },
        },
      ]
    : []
  return [...marks, ...summary].toSorted((a, b) => a.x - b.x)
}

/**
 * Every logged session of every course as a mark on a log axis of real ÷ planned time, against the line of the plan.
 * From `MIN_LOGGED` logged sessions a course also shows its typical session with its 95% interval.
 */
export function RatioStrip({ plan }: { plan: Plan }) {
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)
  const [hover, setHover] = useState<{ row: string; index: number } | null>(null)
  const rows = rowsOf(plan)
  const { lo, hi } = logDomain(
    rows.flatMap((row) => [
      ...row.marks.map((mark) => mark.ratio),
      ...(row.accuracy.typical ? [row.accuracy.typical.low, row.accuracy.typical.high] : []),
    ]),
  )
  const x = logScale(lo, hi, PAD_X, Math.max(PAD_X, width - PAD_X))
  const ticks = ratioTicks(lo, hi)
  const kinds = new Set(rows.flatMap((row) => row.marks.map((mark) => shapeOf(mark.event.kind))))
  const summarised = rows.some((row) => row.accuracy.typical)
  const hide = (row: string) => setHover((shown) => (shown?.row === row ? null : shown))

  function keyDown(e: KeyboardEvent<SVGSVGElement>, row: string, count: number) {
    if (e.key === 'Escape') {
      hide(row)
      return
    }
    const next = stepIndex(e.key, hover?.row === row ? hover.index : 0, count)
    if (next === null) return
    e.preventDefault()
    setHover({ row, index: next })
  }

  return (
    <Card
      title={m.dash_strip_title()}
      hint={m.dash_strip_hint()}
      help={<Hint title={m.help_strip_title()} text={m.help_strip()} />}
      aside={
        rows.length > 0 && (
          <span className="flex flex-wrap gap-x-3.5 gap-y-1">
            {kinds.has('circle') && (
              <Key label={m.kind_study()}>
                <Glyph shape="circle" x={0} y={0} fill="var(--muted)" />
              </Key>
            )}
            {kinds.has('triangle') && (
              <Key label={m.kind_lab()}>
                <Glyph shape="triangle" x={0} y={0} fill="var(--muted)" />
              </Key>
            )}
            {kinds.has('square') && (
              <Key label={m.kind_review()}>
                <Glyph shape="square" x={0} y={0} fill="var(--muted)" />
              </Key>
            )}
            {summarised && (
              <>
                <Key label={m.dash_strip_typical_label()}>
                  <path d="M0,-5L5,0L0,5L-5,0Z" fill="var(--ink)" />
                </Key>
                <Key label={m.dash_strip_interval_label()}>
                  <rect x={-7} y={-3} width={14} height={6} rx={3} fill="var(--ink)" opacity={0.18} />
                </Key>
              </>
            )}
            <Key label={m.dash_strip_plan()}>
              <line x1={0} x2={0} y1={-6} y2={6} stroke="var(--ink)" strokeWidth={1.5} opacity={0.6} />
            </Key>
          </span>
        )
      }
    >
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">{m.dash_strip_none()}</p>
      ) : (
        <>
          <div className="grid gap-y-1 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)] md:gap-x-4">
            {rows.map((row) => {
              const id = row.calendar.id
              const xs = row.marks.map((mark) => x(mark.ratio))
              const slots = stackSlots(xs, 2 * R + 3)
              const reach = Math.max(0, ...slots.map(Math.abs))
              const height = Math.max(ROW_MIN, (2 * reach + 1) * STEP + 2 * R + 8)
              const mid = height / 2
              const { typical, logged } = row.accuracy
              const stops = stopsOf(row, x, xs, slots, mid)
              const active = hover?.row === id ? stops[hover.index] : undefined
              const said = typical
                ? m.dash_strip_n_typical({ count: logged, ratio: fmtRatio(typical.ratio) })
                : m.dash_strip_n_wait({ count: logged, min: MIN_LOGGED })
              return (
                <Fragment key={id}>
                  <div className="min-w-0 self-center text-[13px]/[1.35]" style={calendarColor(row.calendar.color)}>
                    <span className="flex items-baseline gap-2">
                      <Dot className="size-2.5 flex-none -translate-y-px" />
                      <b className="truncate font-semibold">{row.calendar.name}</b>
                    </span>
                    <span className="block text-[12px] text-muted tabular-nums">{said}</span>
                  </div>
                  <div className="relative" style={{ height }}>
                    {width > 0 && (
                      // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the keys walk the readout along the row, as the pointer does
                      <svg
                        width={width}
                        height={height}
                        role="img"
                        aria-label={`${row.calendar.name}: ${said}`}
                        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a chart read with the arrows has to take focus
                        tabIndex={0}
                        className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        onFocus={() => setHover((shown) => (shown?.row === id ? shown : { row: id, index: 0 }))}
                        onBlur={() => hide(id)}
                        onKeyDown={(e) => keyDown(e, id, stops.length)}
                      >
                        {ticks.map((tick) => (
                          <line
                            key={tick}
                            x1={x(tick)}
                            x2={x(tick)}
                            y1={0}
                            y2={height}
                            stroke={tick === 1 ? 'var(--ink)' : 'var(--line-soft)'}
                            strokeWidth={tick === 1 ? 1.5 : 1}
                            opacity={tick === 1 ? 0.6 : 1}
                          />
                        ))}
                        {typical && (
                          <rect
                            x={x(typical.low)}
                            y={mid - 3}
                            width={Math.max(6, x(typical.high) - x(typical.low))}
                            height={6}
                            rx={3}
                            fill="var(--ink)"
                            opacity={0.18}
                          />
                        )}
                        {row.marks.map((mark, i) => (
                          <Glyph
                            key={mark.event.uid}
                            shape={shapeOf(mark.event.kind)}
                            x={xs[i] ?? 0}
                            y={mid + (slots[i] ?? 0) * STEP}
                            fill={row.calendar.color}
                          />
                        ))}
                        {typical && (
                          <path
                            d={`M${x(typical.ratio)},${mid - 6}l6,6l-6,6l-6,-6Z`}
                            fill="var(--ink)"
                            stroke="var(--surface)"
                            strokeWidth={2}
                          />
                        )}
                        {active && (
                          <circle
                            cx={active.x}
                            cy={active.y}
                            r={active.uid === undefined ? 9 : R + 3}
                            fill="none"
                            stroke="var(--ink)"
                            strokeWidth={1.5}
                          />
                        )}
                        {/* Hit targets wider than the marks, drawn last so they are on top, the typical session's last of all. */}
                        {stops
                          .toSorted((a, b) => Number(a.uid === undefined) - Number(b.uid === undefined))
                          .map((stop) => (
                            <circle
                              key={stop.uid ?? 'typical'}
                              data-mark={stop.uid}
                              cx={stop.x}
                              cy={stop.y}
                              r={stop.r}
                              fill="transparent"
                              onPointerEnter={() => setHover({ row: id, index: stops.indexOf(stop) })}
                              onPointerLeave={() => hide(id)}
                            />
                          ))}
                      </svg>
                    )}
                    <ChartTip tip={active?.tip ?? null} width={width} />
                  </div>
                </Fragment>
              )
            })}
            <div className="max-md:hidden" />
            <div ref={box} style={{ height: AXIS }}>
              {width > 0 && (
                <svg width={width} height={AXIS} className="block" aria-hidden>
                  {ticks.map((tick) => (
                    <text
                      key={tick}
                      x={x(tick)}
                      y={14}
                      textAnchor="middle"
                      className={`text-[11px] tabular-nums ${tick === 1 ? 'fill-ink font-semibold' : 'fill-muted'}`}
                    >
                      {fmtFactor(tick)}
                    </text>
                  ))}
                </svg>
              )}
            </div>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-semibold">{m.dash_strip_table()}</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-[13px] tabular-nums">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    {[m.dash_strip_session(), m.dash_strip_date()].map((label) => (
                      <th key={label} scope="col" className="py-1.5 pr-3 font-medium">
                        {label}
                      </th>
                    ))}
                    {[m.dash_planned(), m.dash_strip_logged(), m.dash_strip_ratio()].map((label) => (
                      <th key={label} scope="col" className="py-1.5 pl-3 text-right font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                {rows.map((row) => (
                  <tbody key={row.calendar.id}>
                    <tr className="border-b border-line-soft">
                      <th scope="rowgroup" colSpan={5} className="pt-2.5 pb-1 text-left font-semibold">
                        {row.calendar.name} ·{' '}
                        <span className="font-normal text-muted">
                          {row.accuracy.typical
                            ? `${m.dash_strip_n_typical({ count: row.accuracy.logged, ratio: fmtRatio(row.accuracy.typical.ratio) })} · ${m.dash_strip_interval_label()} ${fmtFactor(row.accuracy.typical.low)}–${fmtFactor(row.accuracy.typical.high)}`
                            : m.dash_strip_n_wait({ count: row.accuracy.logged, min: MIN_LOGGED })}
                        </span>
                      </th>
                    </tr>
                    {row.marks.map((mark) => (
                      <tr key={mark.event.uid} className="border-b border-line-soft last:border-b-0">
                        <td className="py-1.5 pr-3">{mark.event.title}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDay(parseLocal(mark.event.start))}</td>
                        <td className="py-1.5 pl-3 text-right">{fmtDuration(mark.planned * MINUTE)}</td>
                        <td className="py-1.5 pl-3 text-right">{fmtDuration(mark.actual * MINUTE)}</td>
                        <td className="py-1.5 pl-3 text-right whitespace-nowrap">{fmtRatio(mark.ratio)}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </details>
        </>
      )}
    </Card>
  )
}
