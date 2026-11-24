import {
  AIR,
  AIR_SHADE,
  GLASS,
  GLASS_SHADE,
  GLINT,
  OUT,
  SAND,
  SAND_GLINT,
  SAND_SHADE,
  SAND_TOP,
  STREAM,
  WOOD,
  WOOD_DARK,
  WOOD_LIGHT,
} from '../model/glass'

export type Rgba = readonly [number, number, number, number]

export interface Palette {
  /** By cell kind */
  kinds: Rgba[]
  /** The grain of plain sand: the colour, a lighter and a darker shade */
  sand: readonly [Rgba, Rgba, Rgba]
}

const CLEAR: Rgba = [0, 0, 0, 0]
const WHITE: Rgba = [255, 255, 255, 255]
const BLACK: Rgba = [0, 0, 0, 255]

/**
 * The glass and the wood keep colours picked by hand, as pixel art is drawn: theme greys made them read as a grey
 * diagram rather than an object. Only the sand follows the theme, and the glass only follows the scheme.
 */
const GLASSES = {
  light: {
    air: [222, 236, 243, 140],
    airShade: [186, 210, 222, 170],
    glass: [170, 197, 210, 255],
    glassShade: [109, 139, 156, 255],
    glint: [255, 255, 255, 255],
  },
  dark: {
    air: [150, 188, 208, 26],
    airShade: [150, 188, 208, 52],
    glass: [132, 166, 183, 255],
    glassShade: [76, 103, 119, 255],
    glint: [232, 245, 252, 215],
  },
} satisfies Record<string, Record<string, Rgba>>
const WALNUT = { light: [184, 131, 82, 255], wood: [139, 91, 55, 255], dark: [88, 55, 32, 255] } satisfies Record<
  string,
  Rgba
>

let scratch: CanvasRenderingContext2D | null | undefined

/**
 * Any CSS colour as bytes, by painting it: the computed colour of a token can be in any syntax (`oklch()`,
 * `color(srgb …)`), and a canvas reads them all.
 */
function bytes(color: string): Rgba {
  scratch ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!scratch) return CLEAR
  scratch.clearRect(0, 0, 1, 1)
  scratch.fillStyle = color
  scratch.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0, a = 0] = scratch.getImageData(0, 0, 1, 1).data
  return [r, g, b, a]
}

const mix = (from: Rgba, to: Rgba, share: number): Rgba => [
  Math.round(from[0] + (to[0] - from[0]) * share),
  Math.round(from[1] + (to[1] - from[1]) * share),
  Math.round(from[2] + (to[2] - from[2]) * share),
  from[3],
]
const isLight = (color: Rgba) => 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2] > 128

/**
 * Per cell, which of the three shades of plain sand it shows: a fixed grain, so the sand does not shimmer. A full
 * avalanche hash, since a single multiply leaves diagonal stripes across neighbouring cells.
 */
export function sandGrain(cells: number): Uint8Array {
  return Uint8Array.from({ length: cells }, (_, cell) => {
    let hash = Math.imul(cell + 1, 0x9e3779b1)
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
    const eighth = (hash ^ (hash >>> 16)) >>> 29
    return eighth < 6 ? 0 : eighth < 7 ? 1 : 2
  })
}

/** The colours of every kind of cell, for sand of the given colour on a light or a dark page */
export function makePalette(sand: Rgba, scheme: 'light' | 'dark'): Palette {
  const glass = GLASSES[scheme]
  const kinds: Rgba[] = []
  kinds[OUT] = CLEAR
  kinds[AIR] = glass.air
  kinds[AIR_SHADE] = glass.airShade
  kinds[GLASS] = glass.glass
  kinds[GLASS_SHADE] = glass.glassShade
  kinds[GLINT] = glass.glint
  kinds[WOOD_LIGHT] = WALNUT.light
  kinds[WOOD] = WALNUT.wood
  kinds[WOOD_DARK] = WALNUT.dark
  kinds[SAND] = sand
  kinds[SAND_TOP] = mix(sand, WHITE, 0.3)
  kinds[SAND_SHADE] = mix(sand, BLACK, 0.24)
  kinds[SAND_GLINT] = mix(sand, WHITE, 0.55)
  kinds[STREAM] = mix(sand, WHITE, 0.12)
  return { kinds, sand: [sand, mix(sand, WHITE, 0.12), mix(sand, BLACK, 0.1)] }
}

/**
 * The palette for the theme in use. `probes` holds one element per token, marked `data-probe`; their computed
 * `color` is resolved for the scheme, which the custom properties themselves are not (they hold the `light-dark()`
 * text).
 */
export function readPalette(probes: HTMLElement): Palette {
  const token = (name: string) => {
    const probe = probes.querySelector(`[data-probe="${name}"]`)
    return probe ? bytes(getComputedStyle(probe).color) : CLEAR
  }
  return makePalette(token('sand'), isLight(token('surface')) ? 'light' : 'dark')
}
