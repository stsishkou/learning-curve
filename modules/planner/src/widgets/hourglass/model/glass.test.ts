import { describe, expect, it } from 'vitest'

import { AIR, buildGlass, drawCells, GLASS, OUT, SAND, WOOD, type Motion } from './glass'

const glass = buildGlass()
const rows = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i)

function cells(passed: number, motion: Motion | null = null) {
  const out = new Uint8Array(glass.width * glass.height)
  drawCells(glass, passed, motion, out)
  return out
}
const sandIn = (out: Uint8Array, ys: number[]) =>
  ys.reduce((sum, y) => sum + out.subarray(y * glass.width, (y + 1) * glass.width).filter((c) => c === SAND).length, 0)
const top = (out: Uint8Array) => sandIn(out, rows(0, glass.neck))
const below = (out: Uint8Array) => sandIn(out, rows(glass.neck, glass.height))
const at = (x: number, y: number) => y * glass.width + x

describe('buildGlass', () => {
  it('fills the top bulb with about 120 grains on a 19 × 35 grid', () => {
    expect([glass.width, glass.height]).toEqual([19, 35])
    expect(glass.grains).toBe(122)
  })

  it('builds the same glass every time', () => {
    expect(buildGlass()).toEqual(glass)
  })

  it('gives every grain its own place in the bottom bulb, below the neck', () => {
    const places = glass.paths.map((path) => path.at(-1) ?? -1)
    expect(new Set(places).size).toBe(glass.grains)
    expect(places.every((cell) => cell >= (glass.neck + 2) * glass.width)).toBe(true)
  })

  it('frames the bulbs in glass between two wooden caps', () => {
    const empty = cells(glass.grains)
    expect(empty[at(glass.center, 0)]).toBe(WOOD)
    expect(empty[at(glass.center, glass.height - 1)]).toBe(WOOD)
    expect(empty[at(glass.center - 1, glass.neck)]).toBe(GLASS)
    expect(empty[at(glass.center, glass.neck)]).toBe(AIR)
    expect(empty[at(1, glass.neck)]).toBe(OUT)
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
        if (i < glass.neck * glass.width && cell === SAND) expect(before[i]).toBe(SAND)
        if (i >= glass.neck * glass.width && before[i] === SAND) expect(cell).toBe(SAND)
      }
    }
  })

  it('takes the grain in flight from the top and drops it along its path', () => {
    for (const passed of [0, 40, glass.grains - 1]) {
      const path = glass.paths[passed] ?? []
      const start = cells(passed, { phase: 0, landing: 0 })
      expect(top(start)).toBe(glass.grains - passed - 1)
      expect(start[path[0] ?? -1]).toBe(SAND)
      expect(cells(passed, { phase: 0, landing: 1 })[path.at(-1) ?? -1]).toBe(SAND)
    }
  })

  it('pours a stream through the neck while the sand falls, and none once it has run out', () => {
    const neck = (out: Uint8Array) => out[at(glass.center, glass.neck)]
    const phases = [0, 1, 2].map((phase) => neck(cells(10, { phase, landing: 0.5 })))
    expect(phases).toContain(SAND)
    expect(phases).toContain(AIR)
    expect(neck(cells(10))).toBe(AIR)
    expect(below(cells(glass.grains, { phase: 1, landing: 0.5 }))).toBe(glass.grains)
  })
})
