import { describe, expect, test } from 'vitest'

import { solveInOrder, type LpModel, type LpSolution, type Solve } from './lp'

const model: Omit<LpModel, 'objective'> = {
  variables: [
    { name: 'x', kind: 'integer', lower: 0, upper: 10 },
    { name: 'y', kind: 'integer', lower: 0, upper: 10 },
  ],
  constraints: [
    {
      name: 'enough',
      terms: [
        { v: 'x', c: 1 },
        { v: 'y', c: 1 },
      ],
      op: '>=',
      rhs: 4,
    },
  ],
}
const X = [{ v: 'x', c: 1 }]
const Y = [{ v: 'y', c: 1 }]

const answer = (status: LpSolution['status'], objective = 0, gap = 0): LpSolution => ({
  status,
  values: { x: 0, y: 4 },
  objective,
  gap,
})

/** A solver that hands out the given answers in turn and keeps what it was asked. */
function recording(...answers: LpSolution[]) {
  const asked: { model: LpModel; timeLimit: number; start: Record<string, number> | undefined }[] = []
  const solve: Solve = (sent, { timeLimit, start }) => {
    asked.push({ model: sent, timeLimit, start })
    return Promise.resolve(answers[asked.length - 1] ?? answer('error'))
  }
  return { asked, solve }
}

describe('solveInOrder', () => {
  test('solves the levels in turn, each bound by the best of the levels before it', async () => {
    const { asked, solve } = recording(answer('optimal', 0), answer('optimal', 4))
    const result = await solveInOrder(model, [X, Y], solve)
    expect(asked.map((a) => a.model.objective)).toEqual([X, Y])
    expect(asked[0]?.model.constraints).toEqual(model.constraints)
    expect(asked[1]?.model.constraints).toEqual([
      ...model.constraints,
      { name: 'level_1', terms: X, op: '<=', rhs: 1e-6 },
    ])
    expect(result).toEqual({ values: { x: 0, y: 4 }, provenBest: true, gap: 0 })
  })

  test('scales the slack of a bound with the size of the value', async () => {
    const { asked, solve } = recording(answer('optimal', -2000), answer('optimal', 4))
    await solveInOrder(model, [X, Y], solve)
    expect(asked[1]?.model.constraints.at(-1)?.rhs).toBeCloseTo(-2000 + 0.002, 9)
  })

  test('starts each level from the solution of the level before it, which still meets every bound', async () => {
    const { asked, solve } = recording(answer('optimal', 0), answer('optimal', 4))
    await solveInOrder(model, [X, Y], solve)
    expect(asked.map((a) => a.start)).toEqual([undefined, { x: 0, y: 4 }])
  })

  test('starts the first level from a given feasible solution', async () => {
    const { asked, solve } = recording(answer('optimal', 0), answer('optimal', 4))
    await solveInOrder(model, [X, Y], solve, { start: { x: 1, y: 1 } })
    expect(asked.map((a) => a.start)).toEqual([
      { x: 1, y: 1 },
      { x: 0, y: 4 },
    ])
  })

  test('gives every level two seconds unless told otherwise', async () => {
    const { asked, solve } = recording(answer('optimal'), answer('optimal'))
    await solveInOrder(model, [X], solve)
    await solveInOrder(model, [Y], solve, { timeLimit: 5 })
    expect(asked.map((a) => a.timeLimit)).toEqual([2, 5])
  })

  test('keeps the best found at the time limit, but not as proven best, with the largest gap', async () => {
    const { solve } = recording(answer('time-limit', 3, 0.05), answer('time-limit', 4, 0.01))
    expect(await solveInOrder(model, [X, Y], solve)).toMatchObject({ provenBest: false, gap: 0.05 })
  })

  test('throws when the first level has no solution', async () => {
    await expect(solveInOrder(model, [X], recording(answer('infeasible')).solve)).rejects.toThrow(
      'The model has no solution',
    )
    await expect(solveInOrder(model, [X], recording(answer('error')).solve)).rejects.toThrow(
      'The model has no solution',
    )
  })

  test('keeps the levels it solved when a later one fails', async () => {
    const { solve } = recording(answer('optimal', 0), answer('error'))
    expect(await solveInOrder(model, [X, Y], solve)).toEqual({ values: { x: 0, y: 4 }, provenBest: false, gap: 0 })
  })
})
