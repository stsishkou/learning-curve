import type { LpModel, LpSolution, LpTerm, LpVariable, Solve } from '@lc/plan-domain'
import highsLoader, { type Highs } from 'highs'

let runtime: Promise<Highs> | undefined
const highs = () => (runtime ??= highsLoader())

const NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/
const TERMS_PER_LINE = 8

const number = (n: number) => (n === Infinity ? 'inf' : n === -Infinity ? '-inf' : String(n))

/** A linear expression in LP format, a few terms to a line: continuation lines are part of the format. */
function expression(terms: LpTerm[], fallback: string): string {
  const parts = terms.map(({ v, c }) => `${c < 0 ? '-' : '+'} ${number(Math.abs(c))} ${v}`)
  // LP format has no empty expression: a zero term keeps the line valid without changing its value.
  if (!parts.length) parts.push(`+ 0 ${fallback}`)
  const lines: string[] = []
  for (let i = 0; i < parts.length; i += TERMS_PER_LINE) lines.push(parts.slice(i, i + TERMS_PER_LINE).join(' '))
  return lines.join('\n   ')
}

/** The model in CPLEX LP format, the text HiGHS reads. */
function lpText(model: LpModel): string {
  for (const { name } of [...model.variables, ...model.constraints]) {
    if (!NAME.test(name)) throw new Error(`"${name}" cannot be a name in an LP file`)
  }
  const fallback = model.variables[0]?.name
  if (fallback === undefined) throw new Error('The model has no variables')
  const of = (kind: string) => model.variables.filter((v) => v.kind === kind).map((v) => v.name)
  const binaries = of('binary')
  const generals = of('integer')
  return [
    'Minimize',
    ` obj: ${expression(model.objective, fallback)}`,
    'Subject To',
    ...model.constraints.map((c) => ` ${c.name}: ${expression(c.terms, fallback)} ${c.op} ${number(c.rhs)}`),
    'Bounds',
    ...model.variables
      .filter((v) => v.kind !== 'binary')
      .map((v) => ` ${number(v.lower)} <= ${v.name}${v.upper === null ? '' : ` <= ${number(v.upper)}`}`),
    ...(binaries.length ? ['Binaries', ` ${binaries.join(' ')}`] : []),
    ...(generals.length ? ['Generals', ` ${generals.join(' ')}`] : []),
    'End',
    '',
  ].join('\n')
}

const failed = (status: LpSolution['status']): LpSolution => ({ status, values: {}, objective: 0, gap: 0 })

/** HiGHS meets integrality within a tolerance: 0.9999999 is the 1 it means. */
const integral = (v: LpVariable, value: number) => (v.kind === 'continuous' ? value : Math.round(value))

/** Solves a model with HiGHS. The solve blocks the thread for at most `timeLimit` seconds. */
export const solveLp: Solve = async (model, { timeLimit, start }) => {
  const solver = await highs()
  const { modelStatus: codes } = solver.constants
  return solver.withModel({ format: 'lp', data: lpText(model) }, (instance): LpSolution => {
    instance.options.set({ output_flag: false, time_limit: timeLimit })
    const { numCols } = instance.getDimensions()
    const names = Array.from({ length: numCols }, (_, i) => instance.getColName(i))
    if (start) instance.setSolution({ colValue: names.map((name) => start[name] ?? 0) })
    const { modelStatus } = instance.run()
    if (modelStatus === codes.infeasible || modelStatus === codes.unboundedOrInfeasible) return failed('infeasible')
    if (modelStatus !== codes.optimal && modelStatus !== codes.timeLimit) return failed('error')
    // A time limit can stop the search before any feasible point: there is nothing to keep then.
    if (Number(instance.info.get('primal_solution_status')) !== 2) return failed('error')
    const { colValue } = instance.getSolution()
    const found = new Map(names.map((name, i) => [name, colValue[i] ?? 0]))
    const values = Object.fromEntries(
      model.variables.map((v) => [v.name, integral(v, found.get(v.name) ?? (Number.isFinite(v.lower) ? v.lower : 0))]),
    )
    const gap = modelStatus === codes.optimal ? 0 : Number(instance.info.get('mip_gap'))
    return {
      status: modelStatus === codes.optimal ? 'optimal' : 'time-limit',
      values,
      objective: instance.getObjectiveValue(),
      gap: Number.isFinite(gap) ? gap : 1,
    }
  })
}
