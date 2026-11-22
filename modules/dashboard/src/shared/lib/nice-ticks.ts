/** Round axis values from 0 up to at least `max`, about `count` of them. */
export function niceTicks(max: number, count = 4): number[] {
  const rough = Math.max(max, 1) / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= rough) ?? rough
  const ticks: number[] = []
  for (let value = 0; value < max + step; value += step) ticks.push(Math.round(value * 100) / 100)
  return ticks
}
