import { AIR, GLASS, GLINT_CELL, OUT, POST, SAND, WOOD } from '../model/glass'

export type Rgba = readonly [number, number, number, number]

export interface Palette {
  /** By cell kind */
  kinds: Rgba[]
  /** The sand's grain: the colour, a lighter and a darker shade */
  sand: readonly [Rgba, Rgba, Rgba]
}

const CLEAR: Rgba = [0, 0, 0, 0]
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
const fade = (color: Rgba, alpha: number): Rgba => [color[0], color[1], color[2], Math.round(color[3] * alpha)]
const light = (color: Rgba) => 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2] > 128

/**
 * The colours of the glass from the theme. `probes` holds one element per token, marked `data-probe`; their
 * computed `color` is resolved for the scheme in use, which the custom properties themselves are not (they hold the
 * `light-dark()` text).
 */
export function readPalette(probes: HTMLElement): Palette {
  const token = (name: string) => {
    const probe = probes.querySelector(`[data-probe="${name}"]`)
    return probe ? bytes(getComputedStyle(probe).color) : CLEAR
  }
  const sand = token('sand')
  const ink = token('ink')
  const muted = token('muted')
  const surface = token('surface')
  const kinds: Rgba[] = []
  kinds[OUT] = CLEAR
  kinds[AIR] = fade(token('air'), 0.6)
  kinds[SAND] = sand
  kinds[GLASS] = fade(muted, 0.6)
  kinds[WOOD] = mix(muted, ink, 0.4)
  kinds[POST] = fade(muted, 0.8)
  kinds[GLINT_CELL] = light(surface) ? surface : fade(ink, 0.3)
  return { kinds, sand: [sand, mix(sand, surface, 0.22), mix(sand, ink, 0.16)] }
}
