export interface Tip {
  /** Where the tooltip points, px from the left of the chart */
  x: number
  title: string
  rows: { color?: string; label: string; value: string }[]
}

/** The readout that follows the pointer over a chart; everything it says is also in the data table. */
export function ChartTip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null
  const left = tip.x > width / 2
  return (
    <div
      className="pointer-events-none absolute top-1 z-2 min-w-[150px] rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-[0_8px_24px_rgb(10_16_30/0.18)]"
      style={left ? { right: width - tip.x + 12 } : { left: tip.x + 12 }}
    >
      <div className="mb-1 font-semibold">{tip.title}</div>
      {tip.rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          {row.color && <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: row.color }} />}
          <b className="font-semibold tabular-nums">{row.value}</b>
          <span className="text-muted">{row.label}</span>
        </div>
      ))}
    </div>
  )
}
