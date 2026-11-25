import { fmtHours, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, weekOutcomes, type Plan, type WeekOutcome } from '@lc/plan-domain'
import { useMemo, useRef, useState } from 'react'

import { niceTicks, useWidth } from '../../../shared/lib'
import { Card, ChartTip, LegendKey, type Tip } from '../../../shared/ui'

const HEIGHT = 220
const PAD = { above: 16, right: 16, bottom: 26, left: 40 }
const MAX_BAR = 12
/** Surface-colored gap between the bars of one week, px */
const GAP = 2

// The plan is the context the other two are read against, so it stays gray. Done and the time it took are the
// burn-up's colors, with dark steps of their own that keep both inside the dark surface's lightness band.
const PLANNED = 'color-mix(in srgb, var(--muted) 40%, var(--surface))'
const DONE = 'light-dark(#1f9d6b, #2aa874)'
const SPENT = 'light-dark(#2f5bea, #6f8ef2)'

const SERIES = [
  { key: 'planned', color: PLANNED, label: () => m.dash_planned() },
  { key: 'done', color: DONE, label: () => m.dash_done() },
  { key: 'spent', color: SPENT, label: () => m.review_spent() },
] as const

const span = (monday: number) => `${fmtShort(monday)} – ${fmtShort(monday + 6 * DAY)}`

interface Props {
  plan: Plan
  /** Minsk wall-clock ms; null before the clock is known */
  now: number | null
}

/** Each week so far: the hours it planned, the ones done and the time they took, with its misses and review note. */
export function WeekOutcomes({ plan, now }: Props) {
  const weeks = useMemo(() => (now === null ? [] : weekOutcomes(plan, now)), [plan, now])
  // The chart mounts with its box, so the box is there when its width is first measured.
  return now !== null && weeks.length > 0 && <Outcomes weeks={weeks} now={now} />
}

function Outcomes({ weeks, now }: { weeks: WeekOutcome[]; now: number }) {
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)
  const [hover, setHover] = useState<number | null>(null)

  const ticks = niceTicks(Math.max(1, ...weeks.map((w) => Math.max(w.planned, w.spent))))
  const peak = ticks.at(-1) ?? 1
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.above - PAD.bottom
  const band = plotW / weeks.length
  const bar = Math.max(2, Math.min(MAX_BAR, (band - 8 - 2 * GAP) / 3))
  const group = 3 * bar + 2 * GAP
  const y = (hours: number) => PAD.above + plotH - (hours / peak) * plotH
  const center = (i: number) => PAD.left + band * (i + 0.5)
  const every = Math.max(1, Math.ceil(weeks.length / Math.max(1, Math.floor(plotW / 64))))
  const notes = weeks.filter((w) => w.note?.trim()).toReversed()

  const hovered = hover === null ? null : weeks[hover]
  const tip: Tip | null =
    hover === null || !hovered
      ? null
      : {
          x: center(hover),
          title: span(hovered.monday),
          rows: [
            ...SERIES.map((s) => ({ color: s.color, label: s.label(), value: fmtHours(hovered[s.key]) })),
            ...(hovered.missed ? [{ label: m.dash_missed(), value: String(hovered.missed) }] : []),
            ...(hovered.skipped ? [{ label: m.dash_skipped(), value: String(hovered.skipped) }] : []),
          ],
        }

  return (
    <Card
      title={m.dash_outcomes()}
      hint={m.dash_outcomes_hint()}
      aside={
        <span className="flex min-w-0 flex-wrap gap-x-3.5 gap-y-1">
          {SERIES.map((s) => (
            <LegendKey key={s.key} color={s.color} label={s.label()} />
          ))}
        </span>
      }
    >
      <div ref={box} className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={m.dash_outcomes()} className="block">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--line-soft)" />
                <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                  {tick}
                </text>
              </g>
            ))}
            {weeks.map((week, i) => {
              const current = now < week.monday + 7 * DAY
              return (
                <g key={week.monday}>
                  {hover === i && (
                    <rect x={PAD.left + band * i} y={PAD.above} width={band} height={plotH} fill="var(--surface-2)" />
                  )}
                  {SERIES.map((s, k) => {
                    const hours = week[s.key]
                    if (!hours) return null
                    const bottom = y(0)
                    const height = Math.max(1, bottom - y(hours))
                    const left = center(i) - group / 2 + k * (bar + GAP)
                    const r = Math.min(4, height, bar / 2)
                    return (
                      <path
                        key={s.key}
                        style={{ fill: s.color }}
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
                  {/* The whole band is the hit target, not only the thin bars. */}
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
          </svg>
        )}
        <ChartTip tip={tip} width={width} />
      </div>

      {notes.length > 0 && (
        <>
          <h3 className="mt-4 text-[12px] font-semibold tracking-wide text-muted uppercase">
            {m.dash_outcomes_notes()}
          </h3>
          <ul className="mt-1.5 grid grid-cols-[minmax(0,1fr)] gap-2 text-[13.5px]">
            {notes.map((week) => (
              <li key={week.monday} className="min-w-0">
                <span className="font-semibold tabular-nums">{span(week.monday)}</span>
                <Misses week={week} />
                <p className="break-words">{week.note}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] font-semibold">{m.dash_outcomes_table()}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px] tabular-nums">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  {m.dash_week()}
                </th>
                {[...SERIES.map((s) => s.label()), m.dash_missed(), m.dash_skipped()].map((label) => (
                  <th key={label} scope="col" className="py-1.5 pl-3 text-right font-medium">
                    {label}
                  </th>
                ))}
                <th scope="col" className="py-1.5 pl-3 font-medium">
                  {m.dash_note()}
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.monday} className="border-b border-line-soft align-top last:border-b-0">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal whitespace-nowrap">
                    {span(week.monday)}
                  </th>
                  {SERIES.map((s) => (
                    <td key={s.key} className="py-1.5 pl-3 text-right">
                      {fmtHours(week[s.key])}
                    </td>
                  ))}
                  <td className="py-1.5 pl-3 text-right">{week.missed}</td>
                  <td className="py-1.5 pl-3 text-right">{week.skipped}</td>
                  <td className="py-1.5 pl-3">{week.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  )
}

function Misses({ week }: { week: WeekOutcome }) {
  if (!week.missed) return null
  return (
    <span className="text-muted tabular-nums">
      {' · '}
      {m.dash_course_missed({ count: week.missed })}
      {week.skipped > 0 && `, ${m.review_skipped({ count: week.skipped })}`}
    </span>
  )
}
