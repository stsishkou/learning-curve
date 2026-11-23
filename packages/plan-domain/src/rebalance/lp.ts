/** `c · v`: one term of a linear expression */
export interface LpTerm {
  v: string
  c: number
}

export interface LpVariable {
  name: string
  kind: 'binary' | 'integer' | 'continuous'
  lower: number
  /** null for no upper bound */
  upper: number | null
}

export interface LpConstraint {
  name: string
  terms: LpTerm[]
  op: '<=' | '>=' | '='
  rhs: number
}

/** A mixed-integer linear program. The objective is minimised. */
export interface LpModel {
  variables: LpVariable[]
  constraints: LpConstraint[]
  objective: LpTerm[]
}

export interface LpSolution {
  status: 'optimal' | 'time-limit' | 'infeasible' | 'error'
  /** Variable values; meaningful for `optimal` and `time-limit` only */
  values: Record<string, number>
  objective: number
  /** Relative distance to the proven bound; 0 when the solution is proven optimal */
  gap: number
}

/**
 * Solves one model. Injected, so the domain stays free of the solver: plan-data passes HiGHS, tests pass a fake.
 * `timeLimit` is in seconds; `start` is a feasible solution to begin from.
 */
export type Solve = (
  model: LpModel,
  options: { timeLimit: number; start?: Record<string, number> | undefined },
) => Promise<LpSolution>

export interface OrderedSolution {
  values: Record<string, number>
  /** False when any level stopped at its time limit, or a later level failed */
  provenBest: boolean
  /** The largest gap of a level that stopped at its time limit */
  gap: number
}

/**
 * Minimises the levels one after another: each level is solved with every level before it held at its best value,
 * so a later aim can never buy itself a worse result in an earlier one. The slack keeps a bound that the solver
 * met within its own tolerance from making the next model infeasible. `start`, a feasible solution, is where the
 * first level begins; `timeLimit` is in seconds a level.
 */
export async function solveInOrder(
  model: Omit<LpModel, 'objective'>,
  levels: LpTerm[][],
  solve: Solve,
  { timeLimit = 2, start }: { timeLimit?: number; start?: Record<string, number> | undefined } = {},
): Promise<OrderedSolution> {
  const constraints = [...model.constraints]
  let values = start
  let provenBest = true
  let gap = 0
  for (const [index, objective] of levels.entries()) {
    // The level before's solution meets every bound so far, so a level stopped by its time limit keeps at least that.
    // oxlint-disable-next-line no-await-in-loop -- each level needs the bounds of the levels before it
    const solution = await solve(
      { variables: model.variables, constraints: [...constraints], objective },
      { timeLimit, start: values },
    )
    if (solution.status === 'infeasible' || solution.status === 'error') {
      if (index === 0) throw new Error('The model has no solution')
      provenBest = false
      break
    }
    if (solution.status === 'time-limit') {
      provenBest = false
      gap = Math.max(gap, solution.gap)
    }
    ;({ values } = solution)
    const rhs = solution.objective + 1e-6 * Math.max(1, Math.abs(solution.objective))
    constraints.push({ name: `level_${index + 1}`, terms: objective, op: '<=', rhs })
  }
  return { values: values ?? {}, provenBest, gap }
}
