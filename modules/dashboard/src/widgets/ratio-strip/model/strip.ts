/**
 * The line each dot sits on, in order: 0 is the middle, then -1, 1, -2, 2 and so on. A dot takes the first line
 * where no dot placed before it is closer than `gap` px, so equal ratios stack instead of hiding each other.
 */
export function stackSlots(xs: readonly number[], gap: number): number[] {
  const placed: { x: number; slot: number }[] = []
  return xs.map((x) => {
    let slot = 0
    for (let step = 1; placed.some((p) => p.slot === slot && Math.abs(p.x - x) < gap); step++) {
      slot = step % 2 ? -Math.ceil(step / 2) : step / 2
    }
    placed.push({ x, slot })
    return slot
  })
}
