const STEPS: Record<string, (index: number, last: number) => number> = {
  ArrowRight: (index, last) => Math.min(last, index + 1),
  ArrowDown: (index, last) => Math.min(last, index + 1),
  ArrowLeft: (index) => Math.max(0, index - 1),
  ArrowUp: (index) => Math.max(0, index - 1),
  Home: () => 0,
  End: (_, last) => last,
}

/** The stop of a chart a key moves to from `index` among `count`; null for a key the chart does not take. */
export function stepIndex(key: string, index: number, count: number): number | null {
  const step = STEPS[key]
  return step ? step(index, count - 1) : null
}
