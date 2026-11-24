/** Half-widths of the top bulb's rows inside the glass, from the cap to the neck. The bottom bulb mirrors it. */
const BULB = [9, 11, 12, 13, 13, 13, 13, 13, 13, 13, 13, 12, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 0, 0]
/** Empty rows above the sand of a full glass */
const HEADROOM = 5
/** Rows of each cap */
const CAP = 4
/** Where the posts swell into turned beads: rows counted from the top of a post, and from its bottom */
const BEADS = [0, 9]
/** Darker streaks of grain in the caps: [x, length] */
const GRAIN = [
  [5, 3],
  [15, 5],
  [27, 3],
]

/** What a cell of a frame shows */
export const OUT = 0
export const AIR = 1
/** Air along the right wall, where the glass curves away from the light */
export const AIR_SHADE = 2
export const GLASS = 3
export const GLASS_SHADE = 4
/** A highlight on the glass over air */
export const GLINT = 5
export const WOOD_LIGHT = 6
export const WOOD = 7
export const WOOD_DARK = 8
export const SAND = 9
/** Sand with air above it: the lit surface of a pile */
export const SAND_TOP = 10
export const SAND_SHADE = 11
/** A highlight on the glass over sand */
export const SAND_GLINT = 12
export const STREAM = 13
export const KINDS = 14

export const isSand = (kind: number | undefined) => kind !== undefined && kind >= SAND

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
  /** Glass, wood and air: the same in every frame */
  frame: Uint8Array
  /** 1 for the cells inside the glass */
  interior: Uint8Array
  /** 1 for the cells under a highlight of the glass */
  glint: Uint8Array
  /** The first and the last row inside the glass */
  top: number
  floor: number
  /** The one-cell row between the bulbs */
  neck: number
  center: number
}

/** The sand in motion: `phase` (0…3) steps the stream, `landing` (0…1) is how far the grain in flight has fallen */
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
  // From the middle out: the bulb, its glass wall, a gap the beads fill, a post of two cells, the bead rim, the cap.
  const center = half + 6
  const width = 2 * center + 1
  const top = CAP
  const neck = top + BULB.length
  const bottom = neck + 1
  const height = bottom + BULB.length + CAP
  const floor = bottom + BULB.length - 1
  const halfWidth = (y: number): number =>
    y >= top && y < neck
      ? (BULB[y - top] ?? -1)
      : y === neck
        ? 0
        : y >= bottom && y <= floor
          ? (BULB[floor - y] ?? -1)
          : -1
  const inside = (x: number, y: number) => Math.abs(x - center) <= halfWidth(y)
  const at = (x: number, y: number) => y * width + x
  const interior = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (inside(x, y)) interior[at(x, y)] = 1
  const rand = random(seed)

  // The classic rule: straight down, else a diagonal (random side first), else stay.
  const step = (cells: Uint8Array, x: number, y: number, last: number, diagonal: boolean): number | null => {
    const free = (nx: number, ny: number) => ny <= last && inside(nx, ny) && cells[at(nx, ny)] === 0
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
          if (cells[at(x, y)] !== 1) continue
          const to = step(cells, x, y, last, diagonal)
          if (to === null) continue
          cells[at(x, y)] = 0
          cells[to] = 1
          moved = true
        }
      }
      return moved
    }
    while (sweep(false) || sweep(true));
  }

  const upper = new Uint8Array(width * height)
  for (let y = top + HEADROOM; y < neck; y++) for (let x = 0; x < width; x++) if (inside(x, y)) upper[at(x, y)] = 1
  const grains = upper.reduce((sum, cell) => sum + cell, 0)

  const emptiedAt = new Int16Array(width * height).fill(-1)
  for (let passed = 1; passed <= grains; passed++) {
    const before = upper.slice()
    upper[at(center, neck - 1)] = 0
    settle(upper, top, neck - 1)
    for (const [cell, was] of before.entries()) if (was === 1 && upper[cell] === 0) emptiedAt[cell] = passed
  }

  const lower = new Uint8Array(width * height)
  const filledAt = new Int16Array(width * height).fill(-1)
  const paths: number[][] = []
  for (let grain = 0; grain < grains; grain++) {
    let cell = at(center, bottom)
    const path = [cell]
    for (let to = step(lower, center, bottom, floor, true); to !== null;) {
      cell = to
      path.push(cell)
      to = step(lower, cell % width, Math.floor(cell / width), floor, true)
    }
    lower[cell] = 1
    filledAt[cell] = grain
    paths.push(path)
  }

  const frame = new Uint8Array(width * height)
  const paint = (x: number, y: number, kind: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) frame[at(x, y)] = kind
  }
  // The light comes from the upper left: the right wall of the glass and the air along it are darker.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inside(x, y)) paint(x, y, x === center + halfWidth(y) && halfWidth(y) > 0 ? AIR_SHADE : AIR)
      else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1))
        paint(x, y, x > center ? GLASS_SHADE : GLASS)
    }
  }
  // Two turned posts: a lit and a shaded column that swell into beads three rows tall, lit on their upper half.
  const postTop = CAP
  const postBottom = height - CAP - 1
  const beads = [...BEADS.map((r) => postTop + r), ...BEADS.map((r) => postBottom - r), neck]
  const BEAD: Record<number, readonly [number, number, number, number]> = {
    [-1]: [WOOD, WOOD_LIGHT, WOOD_LIGHT, WOOD],
    0: [WOOD_LIGHT, WOOD_LIGHT, WOOD, WOOD_DARK],
    1: [WOOD_DARK, WOOD, WOOD_DARK, WOOD_DARK],
  }
  const post = (from: number, y: number) => {
    const nearest = beads.reduce((best, row) => (Math.abs(y - row) < Math.abs(y - best) ? row : best))
    const bead = BEAD[y - nearest]
    if (bead) for (const [i, kind] of bead.entries()) paint(from + i, y, kind)
    else {
      paint(from + 1, y, WOOD_LIGHT)
      paint(from + 2, y, WOOD_DARK)
    }
  }
  for (let y = postTop; y <= postBottom; y++) {
    post(1, y)
    post(width - 5, y)
  }
  // The caps: a lit top face, the body with its grain, a shaded edge; the corners are cut round.
  const cap = (face: number) => {
    const [body, grain, edge] = [face + 1, face + 2, face + 3]
    for (let x = 1; x < width - 1; x++) paint(x, face, WOOD_LIGHT)
    for (const y of [body, grain]) for (let x = 0; x < width; x++) paint(x, y, WOOD)
    paint(0, body, WOOD_LIGHT)
    paint(width - 1, body, WOOD_DARK)
    paint(width - 1, grain, WOOD_DARK)
    for (const [x = 0, length = 0] of GRAIN) for (let i = 0; i < length; i++) paint(x + i, grain, WOOD_DARK)
    for (let x = 1; x < width - 1; x++) paint(x, edge, WOOD_DARK)
  }
  cap(0)
  cap(height - CAP)

  // Highlights on the glass: a long streak inside the left wall of each bulb and a short one on the right.
  const glint = new Uint8Array(width * height)
  const streaks = (rowOf: (i: number) => number) => {
    for (let i = 2; i <= 10; i++) {
      const y = rowOf(i)
      glint[at(center - halfWidth(y) + 2, y)] = 1
      if (i >= 3 && i <= 6) glint[at(center - halfWidth(y) + 3, y)] = 1
    }
    for (let i = 4; i <= 6; i++) glint[at(center + halfWidth(rowOf(i)) - 2, rowOf(i))] = 1
  }
  streaks((i) => top + i)
  streaks((i) => floor - i)
  for (const [cell, on] of glint.entries()) if (on === 1) frame[cell] = GLINT

  return { width, height, grains, emptiedAt, filledAt, paths, frame, interior, glint, top, floor, neck, center }
}

/**
 * The cells after `passed` grains (0…grains). With `motion`, grain `passed` is in flight: it has left the top, a
 * stream pours through the neck and the grain lands along its path. Without it (paused, reduced motion) the sand
 * stands still and only changes a grain at a time. The sand is then shaded: lit where air is above it, darker
 * along the right wall, and lighter again under the highlights of the glass.
 */
export function drawCells(glass: Glass, passed: number, motion: Motion | null, out: Uint8Array) {
  const { width, frame, interior, glint } = glass
  out.set(frame)
  const falling = motion !== null && passed < glass.grains
  const left = falling ? passed + 1 : passed
  for (let cell = 0; cell < out.length; cell++) {
    const emptied = glass.emptiedAt[cell] ?? -1
    const filled = glass.filledAt[cell] ?? -1
    if (emptied > left || (filled !== -1 && filled < passed)) out[cell] = SAND
  }
  if (falling) {
    for (let y = glass.neck; y < glass.height; y++) {
      const cell = y * width + glass.center
      if (interior[cell] !== 1 || isSand(out[cell])) break
      if ((y + motion.phase) % 4 !== 0) out[cell] = STREAM
    }
    const path = glass.paths[passed] ?? []
    const cell = path[Math.min(path.length - 1, Math.floor(motion.landing * path.length))]
    if (cell !== undefined) out[cell] = SAND
  }
  for (let cell = width; cell < out.length; cell++) {
    if (out[cell] !== SAND) continue
    if (glint[cell] === 1) out[cell] = SAND_GLINT
    else if (interior[cell - width] === 1 && !isSand(out[cell - width])) out[cell] = SAND_TOP
    else if (frame[cell] === AIR_SHADE) out[cell] = SAND_SHADE
  }
}
