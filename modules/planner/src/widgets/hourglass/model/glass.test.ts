import { describe, expect, it } from 'vitest'

import {
  AIR,
  buildGlass,
  drawCells,
  GLASS,
  GLASS_SHADE,
  isSand,
  OUT,
  SAND,
  SAND_GLINT,
  SAND_SHADE,
  SAND_TOP,
  STREAM,
  WOOD_DARK,
  WOOD_LIGHT,
  type Motion,
} from './glass'

const glass = buildGlass()
const rows = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i)

function cells(passed: number, motion: Motion | null = null) {
  const out = new Uint8Array(glass.width * glass.height)
  drawCells(glass, passed, motion, out)
  return out
}
const sandIn = (out: Uint8Array, ys: number[]) =>
  ys.reduce((sum, y) => sum + out.subarray(y * glass.width, (y + 1) * glass.width).filter(isSand).length, 0)
const top = (out: Uint8Array) => sandIn(out, rows(0, glass.neck))
const below = (out: Uint8Array) => sandIn(out, rows(glass.neck, glass.height))
const at = (x: number, y: number) => y * glass.width + x

describe('buildGlass', () => {
  it('fills the top bulb with 360 grains on a 39 × 63 grid', () => {
    expect([glass.width, glass.height]).toEqual([39, 63])
    expect(glass.grains).toBe(360)
  })

  it('builds the same glass every time', () => {
    expect(buildGlass()).toEqual(glass)
  })

  it('gives every grain its own place in the bottom bulb, below the neck', () => {
    const places = glass.paths.map((path) => path.at(-1) ?? -1)
    expect(new Set(places).size).toBe(glass.grains)
    expect(places.every((cell) => cell >= (glass.neck + 2) * glass.width)).toBe(true)
  })

  it('frames the bulbs in glass, lit from the left, between two wooden caps', () => {
    const empty = cells(glass.grains)
    expect(empty[at(glass.center, 0)]).toBe(WOOD_LIGHT)
    expect(empty[at(glass.center, glass.height - 1)]).toBe(WOOD_DARK)
    expect(empty[at(glass.center - 1, glass.neck)]).toBe(GLASS)
    expect(empty[at(glass.center + 1, glass.neck)]).toBe(GLASS_SHADE)
    expect(empty[at(glass.center, glass.neck)]).toBe(AIR)
    expect(empty[at(0, glass.neck)]).toBe(OUT)
  })
})

describe('drawCells', () => {
  it('keeps every grain: the top loses what the bottom gains', () => {
    for (let passed = 0; passed <= glass.grains; passed++) {
      const out = cells(passed)
      expect(top(out)).toBe(glass.grains - passed)
      expect(below(out)).toBe(passed)
    }
  })

  it('never refills a cell of the top, nor empties one of the bottom', () => {
    for (let passed = 1; passed <= glass.grains; passed++) {
      const before = cells(passed - 1)
      const after = cells(passed)
      for (const [i, cell] of after.entries()) {
        if (i < glass.neck * glass.width && isSand(cell)) expect(isSand(before[i])).toBe(true)
        if (i >= glass.neck * glass.width && isSand(before[i])) expect(isSand(cell)).toBe(true)
      }
    }
  })

  it('takes the grain in flight from the top and drops it along its path', () => {
    for (const passed of [0, 40, glass.grains - 1]) {
      const path = glass.paths[passed] ?? []
      const start = cells(passed, { phase: 0, landing: 0 })
      expect(top(start)).toBe(glass.grains - passed - 1)
      expect(isSand(start[path[0] ?? -1])).toBe(true)
      expect(isSand(cells(passed, { phase: 0, landing: 1 })[path.at(-1) ?? -1])).toBe(true)
    }
  })

  it('pours a stream through the neck while the sand falls, and none once it has run out', () => {
    const neck = (out: Uint8Array) => out[at(glass.center, glass.neck)]
    const phases = [0, 1, 2, 3].map((phase) => neck(cells(10, { phase, landing: 0.5 })))
    expect(phases).toContain(STREAM)
    expect(phases).toContain(AIR)
    expect(neck(cells(10))).toBe(AIR)
    expect(below(cells(glass.grains, { phase: 1, landing: 0.5 }))).toBe(glass.grains)
  })

  it('shades the sand: lit on top, darker along the right wall, bright under a highlight', () => {
    const full = cells(0)
    const surface = full.findIndex((cell) => isSand(cell))
    const y = Math.floor(surface / glass.width) + 2
    const row = rows(0, glass.width).map((x) => full[at(x, y)])
    expect(full[surface]).toBe(SAND_TOP)
    expect(full[surface + 2 * glass.width]).toBe(SAND)
    expect(row.findLast(isSand)).toBe(SAND_SHADE)
    expect(row).toContain(SAND_GLINT)
  })
})
