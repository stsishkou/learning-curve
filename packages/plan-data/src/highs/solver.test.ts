import type { LpModel } from '@lc/plan-domain/rebalance'
import { expect, test } from 'vitest'

import { solveLp } from './solver'

const term = (v: string, c: number) => ({ v, c })

/** A textbook workshop: chairs earn 30 and tables 50, within the hours of carpentry and of painting. */
const workshop: LpModel = {
  variables: [
    { name: 'chairs', kind: 'integer', lower: 0, upper: null },
    { name: 'tables', kind: 'integer', lower: 0, upper: null },
  ],
  constraints: [
    { name: 'carpentry', terms: [term('chairs', 4), term('tables', 3)], op: '<=', rhs: 110 },
    { name: 'painting', terms: [term('chairs', 2), term('tables', 5)], op: '<=', rhs: 90 },
  ],
  objective: [term('chairs', -30), term('tables', -50)],
}

test('solves the workshop: 20 chairs and 10 tables earn the most', async () => {
  const solution = await solveLp(workshop, { timeLimit: 5 })
  expect(solution.status).toBe('optimal')
  expect(solution.values.chairs).toBeCloseTo(20, 6)
  expect(solution.values.tables).toBeCloseTo(10, 6)
  expect(solution.objective).toBeCloseTo(-1100, 6)
  expect(solution.gap).toBe(0)
})

test('reads binaries, equalities and negative bounds', async () => {
  const solution = await solveLp(
    {
      variables: [
        { name: 'a', kind: 'binary', lower: 0, upper: 1 },
        { name: 'b', kind: 'binary', lower: 0, upper: 1 },
        { name: 't', kind: 'continuous', lower: -5, upper: 5 },
      ],
      constraints: [
        { name: 'one', terms: [term('a', 1), term('b', 1)], op: '=', rhs: 1 },
        { name: 'floor', terms: [term('t', 1), term('a', -4)], op: '>=', rhs: -3 },
      ],
      objective: [term('t', 1), term('b', 2)],
    },
    { timeLimit: 5 },
  )
  expect(solution.status).toBe('optimal')
  expect(solution.values).toMatchObject({ a: 0, b: 1, t: -3 })
  expect(solution.objective).toBeCloseTo(-1, 6)
})

test('reports a model without a solution as infeasible', async () => {
  const solution = await solveLp(
    {
      variables: [{ name: 'x', kind: 'binary', lower: 0, upper: 1 }],
      constraints: [{ name: 'two', terms: [term('x', 1)], op: '>=', rhs: 2 }],
      objective: [term('x', 1)],
    },
    { timeLimit: 5 },
  )
  expect(solution.status).toBe('infeasible')
})

test('takes a feasible start and still proves the best', async () => {
  const solution = await solveLp(workshop, { timeLimit: 5, start: { chairs: 0, tables: 18 } })
  expect(solution.status).toBe('optimal')
  expect(solution.objective).toBeCloseTo(-1100, 6)
})
