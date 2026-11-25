const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500]

/**
 * Session numbers to label on an axis from `from` to `to`, at most `most` of them: `from` itself, then the multiples
 * of the smallest round step that fit. A multiple nearer to `from` than half a step is left out so labels do not touch.
 */
export function countTicks(from: number, to: number, most: number): number[] {
  const ticksAt = (step: number) => {
    const round = []
    for (let n = Math.ceil((from + step / 2) / step) * step; n <= to; n += step) round.push(n)
    return [from, ...round]
  }
  const fits = STEPS.map(ticksAt).find((ticks) => ticks.length <= Math.max(1, most))
  return fits ?? [from, to]
}
