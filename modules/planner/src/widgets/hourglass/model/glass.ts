/** Half-widths of the top bulb's rows, top first. The bottom bulb mirrors it; the neck is one cell wide. */
const BULB = [5, 6, 7, 7, 7, 7, 7, 6, 6, 5, 4, 3, 2, 1, 0]
/** Empty rows above the sand of a full glass */
const HEADROOM = 3
/** Rows of each wooden cap */
const CAP = 2
/** Rows of the glint on the left wall of each bulb, counted from its wide end */
const GLINT: { from: number; to: number } = { from: 1, to: 5 }

/** What a cell of a frame shows */
export const OUT = 0
export const AIR = 1
export const SAND = 2
export const GLASS = 3
export const WOOD = 4
export const POST = 5
export const GLINT_CELL = 6

const FREE = 0
const FULL = 1

export interface Glass {
  width: number
  height: number
  /** Grains the glass holds: one passes the neck every `length / grains` ms */
  grains: number
  /** Top bulb: grains passed when the cell empties for good; -1 elsewhere */
  emptiedAt: Int16Array
  /** Bottom bulb: the grain that comes to rest in the cell; -1 elsewhere */
  filledAt: Int16Array
  /** Per grain, the cells it crosses from the neck to its place */
  paths: number[][]
  /** Glass, caps and air: the same in every frame */
  frame: Uint8Array
  /** The one-cell row between the bulbs */
  neck: number
  center: number
}

/** The sand in motion: `phase` (0…2) steps the stream, `landing` (0…1) is how far the grain in flight has fallen */
export interface Motion {
  phase: number
  landing: number
}

/** mulberry32: the same pile on every load */
function random(seed: number) {
  let s = seed
  return () => {
    s = Math.imul(s + 0x6d2b79f5, 1) // wraps to 32 bits
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Runs the sand once and keeps when each cell empties or fills, so that a frame is a function of the grains passed:
 * the picture follows the clock, never the frame rate, and a tab that was hidden draws the right frame at once.
 */
export function buildGlass(seed = 7): Glass {
  const half = Math.max(...BULB)
  const width = 2 * half + 5
  const center = half + 2
  const top = CAP
  const neck = CAP + BULB.length
  const bottom = neck + 1
  const height = bottom + BULB.length + CAP
  const halfWidth = (y: number): number =>
    y >= top && y < neck
      ? (BULB[y - top] ?? -1)
      : y === neck
        ? 0
        : y >= bottom && y < bottom + BULB.length
          ? (BULB[BULB.length - 1 - (y - bottom)] ?? -1)
          : -1
  const inside = (x: number, y: number) => Math.abs(x - center) <= halfWidth(y)
  const at = (x: number, y: number) => y * width + x
  const rand = random(seed)

  // The classic rule: straight down, else a diagonal (random side first), else stay.
  const step = (cells: Uint8Array, x: number, y: number, last: number, diagonal: boolean): number | null => {
    const free = (nx: number, ny: number) => ny <= last && inside(nx, ny) && cells[at(nx, ny)] === FREE
    if (free(x, y + 1)) return at(x, y + 1)
    if (!diagonal) return null
    const side = rand() < 0.5 ? -1 : 1
    if (free(x + side, y + 1)) return at(x + side, y + 1)
    if (free(x - side, y + 1)) return at(x - side, y + 1)
    return null
  }
  // Straight falls settle before any slide, so the top drains into a crater rather than from the walls.
  const settle = (cells: Uint8Array, first: number, last: number) => {
    const sweep = (diagonal: boolean) => {
      let moved = false
      const flip = rand() < 0.5 // a fixed direction would lean the crater to one side
      for (let y = last - 1; y >= first; y--) {
        for (let i = 0; i < width; i++) {
          const x = flip ? width - 1 - i : i
          if (cells[at(x, y)] !== FULL) continue
          const to = step(cells, x, y, last, diagonal)
          if (to === null) continue
          cells[at(x, y)] = FREE
          cells[to] = FULL
          moved = true
        }
      }
      return moved
    }
    while (sweep(false) || sweep(true));
  }

  const upper = new Uint8Array(width * height)
  for (let y = top + HEADROOM; y < neck; y++) for (let x = 0; x < width; x++) if (inside(x, y)) upper[at(x, y)] = FULL
  const grains = upper.reduce((sum, cell) => sum + cell, 0)

  const emptiedAt = new Int16Array(width * height).fill(-1)
  for (let passed = 1; passed <= grains; passed++) {
    const before = upper.slice()
    upper[at(center, neck - 1)] = FREE
    settle(upper, top, neck - 1)
    for (const [cell, was] of before.entries()) if (was === FULL && upper[cell] === FREE) emptiedAt[cell] = passed
  }

  const lower = new Uint8Array(width * height)
  const filledAt = new Int16Array(width * height).fill(-1)
  const paths: number[][] = []
  const floor = bottom + BULB.length - 1
  for (let grain = 0; grain < grains; grain++) {
    let cell = at(center, bottom)
    const path = [cell]
    for (let to = step(lower, center, bottom, floor, true); to !== null;) {
      cell = to
      path.push(cell)
      to = step(lower, cell % width, Math.floor(cell / width), floor, true)
    }
    lower[cell] = FULL
    filledAt[cell] = grain
    paths.push(path)
  }

  const frame = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const edge = y === 0 || y === height - 1
    for (let x = 0; x < width; x++) {
      if (y < CAP || y >= height - CAP) frame[at(x, y)] = edge && (x === 0 || x === width - 1) ? OUT : WOOD
      else if (x === 0 || x === width - 1) frame[at(x, y)] = POST
      else if (inside(x, y)) frame[at(x, y)] = AIR
      else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) frame[at(x, y)] = GLASS
    }
  }
  for (let row = GLINT.from; row <= GLINT.to; row++) {
    for (const y of [top + row, height - CAP - 1 - row]) frame[at(center - halfWidth(y), y)] = GLINT_CELL
  }
  return { width, height, grains, emptiedAt, filledAt, paths, frame, neck, center }
}

/**
 * The cells after `passed` grains (0…grains). With `motion`, grain `passed` is in flight: it has left the top, a
 * stream pours through the neck and the grain lands along its path. Without it (paused, reduced motion) the sand
 * stands still and only changes a grain at a time.
 */
export function drawCells(glass: Glass, passed: number, motion: Motion | null, out: Uint8Array) {
  out.set(glass.frame)
  const falling = motion !== null && passed < glass.grains
  const left = falling ? passed + 1 : passed
  for (let cell = 0; cell < out.length; cell++) {
    const emptied = glass.emptiedAt[cell] ?? -1
    const filled = glass.filledAt[cell] ?? -1
    if (emptied > left || (filled !== -1 && filled < passed)) out[cell] = SAND
  }
  if (!falling) return
  for (let y = glass.neck; y < glass.height; y++) {
    const cell = y * glass.width + glass.center
    if (out[cell] !== AIR) break
    if ((y + motion.phase) % 3 !== 0) out[cell] = SAND
  }
  const path = glass.paths[passed] ?? []
  const cell = path[Math.min(path.length - 1, Math.floor(motion.landing * path.length))]
  if (cell !== undefined) out[cell] = SAND
}
