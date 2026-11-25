/** Ratios the axis may mark: pairs the same distance either side of ×1 on a log scale. */
const TICKS = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 1, 3 / 2, 2, 3, 4]
/** Room past the farthest ratio, as a share of its distance from ×1 on the log scale */
const MARGIN = 1.08

/**
 * The span of the axis: symmetric around ×1 on a log scale, so ×2 and ×0.5 lie equally far from the plan, and never
 * narrower than ×0.5 to ×2, so a few close ratios do not look spread out.
 */
export function logDomain(ratios: readonly number[]): { lo: number; hi: number } {
  const far = Math.max(Math.LN2, ...ratios.map((r) => Math.abs(Math.log(r)))) * MARGIN
  return { lo: Math.exp(-far), hi: Math.exp(far) }
}

export const ratioTicks = (lo: number, hi: number) => TICKS.filter((tick) => tick >= lo && tick <= hi)

/** Maps a ratio onto `[from, to]` px on the log scale of the domain. */
export const logScale = (lo: number, hi: number, from: number, to: number) => (ratio: number) =>
  from + ((Math.log(ratio) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (to - from)
