import { calendarColor } from '@lc/ui'
import { useEffect, useRef, useState } from 'react'

import { readPalette, sandGrain, type Palette } from '../lib/palette'
import { useFrames } from '../lib/use-frames'
import { usePixelFit } from '../lib/use-pixel-fit'
import { useReducedMotion } from '../lib/use-reduced-motion'
import { useScheme } from '../lib/use-scheme'
import { buildGlass, drawCells, SAND, type Glass } from '../model/glass'

interface Props {
  /** ms of the block that have run, as measured at `at` */
  run: number
  /** Epoch ms when `run` was measured: while `running` the sand moves on from there with the clock */
  at: number
  /** The whole block in ms */
  length: number
  /** The block is under way. A paused glass holds its sand, without a stream */
  running: boolean
  /** Work pours the course's colour, a rest the colour of what is done */
  tone: 'work' | 'rest'
  /** The course's colour; without one the sand takes the ink */
  color?: string | undefined
  /** No stream, no falling grain and no turn: the sand changes a grain at a time, as with reduced motion */
  still?: boolean | undefined
  /** Changes when a new block starts: the glass turns over */
  turn: string
  /** Sizes the box; the glass is the largest that fits it on whole device pixels */
  className?: string | undefined
}

let shared: Glass | null = null
const theGlass = () => (shared ??= buildGlass())

/** The pace of the stream through the neck: a step every 83 ms, about 12 a second, as pixel art is drawn */
const STREAM_STEP = 83
/** A grain falls into place within this, or within its whole turn when grains pass faster */
const FALL = 600
const TURN: Keyframe[] = [{ transform: 'rotate(180deg)' }, { transform: 'rotate(360deg)' }]

/**
 * A pixel hourglass that counts a block down: the sand in the top is the time left. It is drawn on a canvas of one
 * pixel per cell, scaled up without smoothing, and the frame is worked out from the clock each time, so it is
 * right after a reload or a hidden tab. It is a picture only (`aria-hidden`): the page says the time in words.
 */
export function Hourglass({ run, at, length, running, tone, color, still = false, turn, className = '' }: Props) {
  const glass = theGlass()
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const probes = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()
  const calm = still || reduced
  const fit = usePixelFit(box, glass.width, glass.height)
  const scheme = useScheme()
  const [palette, setPalette] = useState<Palette | null>(null)
  const [grain] = useState(() => sandGrain(glass.width * glass.height))
  const [cells] = useState(() => new Uint8Array(glass.width * glass.height))
  const drawn = useRef('')

  useEffect(() => {
    if (probes.current) setPalette(readPalette(probes.current))
    drawn.current = ''
  }, [tone, color, scheme])

  const paint = (time: number) => {
    const context = canvas.current?.getContext('2d')
    if (!context || !palette) return
    const live = running ? Math.min(length, run + Math.max(0, Date.now() - at)) : Math.min(length, run)
    const passed = length > 0 ? Math.min(glass.grains, Math.floor((glass.grains * live) / length)) : glass.grains
    const slot = length / glass.grains
    const motion =
      running && !calm && passed < glass.grains
        ? {
            phase: Math.floor(time / STREAM_STEP) % 4,
            landing: Math.min(1, (live - passed * slot) / Math.min(FALL, slot)),
          }
        : null
    const path = glass.paths[passed] ?? []
    const key = `${passed}:${motion?.phase ?? '-'}:${motion ? Math.floor(motion.landing * path.length) : '-'}`
    if (key === drawn.current) return
    drawn.current = key
    drawCells(glass, passed, motion, cells)
    const image = context.createImageData(glass.width, glass.height)
    for (const [i, kind] of cells.entries()) {
      const rgba = kind === SAND ? palette.sand[grain[i] ?? 0] : palette.kinds[kind]
      if (rgba) image.data.set(rgba, i * 4)
    }
    context.putImageData(image, 0, 0)
  }

  useEffect(() => paint(performance.now()))
  useFrames(box, running && !calm && fit.cell > 0, paint)

  const turned = useRef(turn)
  useEffect(() => {
    if (turned.current === turn) return
    turned.current = turn
    if (!calm) canvas.current?.animate(TURN, { duration: 650, easing: 'cubic-bezier(.55,0,.25,1)' })
  }, [turn, calm])

  return (
    <div ref={box} className={`relative ${className}`} style={calendarColor(color)} aria-hidden>
      <span ref={probes} hidden>
        <span data-probe="sand" className={tone === 'rest' ? 'text-done' : 'text-cal'} />
        <span data-probe="surface" className="text-surface" />
      </span>
      <canvas
        ref={canvas}
        width={glass.width}
        height={glass.height}
        className="absolute [image-rendering:pixelated]"
        style={{
          left: fit.left,
          top: fit.top,
          width: glass.width * fit.cell,
          height: glass.height * fit.cell,
          visibility: fit.cell ? undefined : 'hidden',
        }}
      />
    </div>
  )
}
