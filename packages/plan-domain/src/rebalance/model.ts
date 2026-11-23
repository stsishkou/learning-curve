import { HOUR, parseLocal } from '../dates'
import type { PlanEvent } from '../types'
import type { LpConstraint, LpModel, LpTerm, LpVariable } from './lp'
import type { Room } from './room'
import type { RebalanceRequest } from './types'

const hoursOf = (e: PlanEvent) => (parseLocal(e.end) - parseLocal(e.start)) / HOUR
/** The room a session takes: its length rounded up to the half-hour grid */
const roomOf = (e: PlanEvent) => Math.ceil(hoursOf(e) * 2 - 1e-9) / 2
const term = (v: string, c = 1): LpTerm => ({ v, c })

/**
 * Step 2 of a re-balance: which session goes on which study day, as an integer program solved level by level.
 * `docs/rebalancing.md` explains every row; in short:
 *
 * - `y_i_d` (binary) puts session `i` on study day `d`; it exists only where the session fits, so most of the
 *   matrix is never built. `u_i` leaves it out; left-out sessions are always the tail of the course.
 * - `t_i` is the index of its day; `t_i ≤ t_{i+1}` keeps the order (relaxed for a left-out next session).
 * - `L_d` is the load of day `d` and `C_d` the hours placed by then: a running sum instead of prefix sums over `y`,
 *   which would cost about a million nonzeros. `e_d` is how far `C_d` is from the ideal line.
 * - `over_w` is the week's load over its room, a variable only when the person allows it.
 * - `Pw`, `Pd` are the heaviest week (everything that counts) and the calendar's heaviest day.
 *
 * Variables are named by index, not uid, so the names stay valid in an LP file.
 */
export function buildModel(
  room: Room,
  sessions: PlanEvent[],
  request: RebalanceRequest,
): { model: Omit<LpModel, 'objective'>; levels: LpTerm[][] } {
  const variables: LpVariable[] = []
  const constraints: LpConstraint[] = []
  const binary = (name: string) => variables.push({ name, kind: 'binary', lower: 0, upper: 1 })
  const continuous = (name: string, upper: number | null = null) =>
    variables.push({ name, kind: 'continuous', lower: 0, upper })
  const row = (name: string, terms: LpTerm[], op: LpConstraint['op'], rhs: number) =>
    constraints.push({ name, terms, op, rhs })

  const D = room.days.length
  const deadline = request.target.mode === 'deadline' ? room.deadline : null
  const total = sessions.reduce((sum, e) => sum + hoursOf(e), 0)

  // Where each session may go.
  const placed = sessions.map((e, i) => {
    const own = room.own.get(e.uid)
    const keep = own?.outside ? own.day : null
    const options = room.days
      .filter((d) => d.day === keep || ((e.kind !== 'lab' || d.lab) && d.cap >= roomOf(e)))
      .map((d) => ({ d, v: `y_${i}_${d.index}`, outside: d.day === keep, e }))
    return { i, own: own?.day, options }
  })
  const byDay = new Map<number, (typeof placed)[number]['options']>()
  for (const { options } of placed) {
    for (const option of options) {
      const list = byDay.get(option.d.index) ?? []
      list.push(option)
      byDay.set(option.d.index, list)
    }
  }
  for (const { options } of placed) for (const { v } of options) binary(v)
  for (const [i] of sessions.entries()) binary(`u_${i}`)
  if (deadline !== null) for (const [i] of sessions.entries()) binary(`late_${i}`)
  for (const [i] of sessions.entries()) continuous(`t_${i}`, D)
  for (const d of room.days) continuous(`L_${d.index}`)
  for (const d of room.days) continuous(`C_${d.index}`)
  for (const d of room.days) continuous(`e_${d.index}`)
  const weeks = [...new Set(room.days.map((d) => d.week))]
  if (request.overBudget) for (const [w] of weeks.entries()) continuous(`over_${w + 1}`)
  continuous('Pw')
  continuous('Pd')

  for (const { i, options } of placed) {
    row(`once_${i}`, [...options.map(({ v }) => term(v)), term(`u_${i}`)], '=', 1)
    row(`day_${i}`, [term(`t_${i}`), ...options.map(({ d, v }) => term(v, -d.index))], '=', 0)
    if (i + 1 < sessions.length) {
      row(`tail_${i}`, [term(`u_${i}`), term(`u_${i + 1}`, -1)], '<=', 0)
      row(`order_${i}`, [term(`t_${i}`), term(`t_${i + 1}`, -1), term(`u_${i + 1}`, -D)], '<=', 0)
    }
    if (deadline !== null) {
      const after = options.filter(({ d }) => d.day >= deadline).map(({ v }) => term(v, -1))
      row(`late_${i}`, [term(`late_${i}`), ...after], '=', 0)
    }
  }

  const before = deadline === null ? 0 : room.days.filter((d) => d.day < deadline).length
  const perDay = request.target.mode === 'pace' ? request.target.perDay : 1
  const ideal = (index: number) =>
    deadline === null
      ? Math.min(total, (perDay * total * index) / Math.max(sessions.length, 1))
      : before === 0
        ? total
        : (total * Math.min(index, before)) / before

  for (const day of room.days) {
    const d = day.index
    const here = byDay.get(d) ?? []
    row(`load_${d}`, [term(`L_${d}`), ...here.map(({ v, e }) => term(v, -hoursOf(e)))], '=', 0)
    const inside = here.filter((o) => !o.outside)
    if (inside.length) {
      row(
        `room_${d}`,
        inside.map(({ v, e }) => term(v, roomOf(e))),
        '<=',
        day.cap,
      )
    }
    const labs = here.filter(({ e }) => e.kind === 'lab')
    if (labs.length > 1) {
      row(
        `labs_${d}`,
        labs.map(({ v }) => term(v)),
        '<=',
        1,
      )
    }
    row(`peakd_${d}`, [term(`L_${d}`), term('Pd', -1)], '<=', 0)
    row(`sum_${d}`, [term(`C_${d}`), ...(d > 1 ? [term(`C_${d - 1}`, -1)] : []), term(`L_${d}`, -1)], '=', 0)
    row(`above_${d}`, [term(`C_${d}`), term(`e_${d}`, -1)], '<=', ideal(d))
    row(`below_${d}`, [term(`C_${d}`, -1), term(`e_${d}`, -1)], '<=', -ideal(d))
  }

  for (const [w, week] of weeks.entries()) {
    const loads = room.days.filter((d) => d.week === week).map((d) => term(`L_${d.index}`))
    const { left = 0, fixed = 0 } = room.weeks.get(week) ?? {}
    row(`week_${w + 1}`, [...loads, ...(request.overBudget ? [term(`over_${w + 1}`, -1)] : [])], '<=', left)
    row(`peakw_${w + 1}`, [...loads, term('Pw', -1)], '<=', -fixed)
  }

  const all = (prefix: string, count: number, from = 0) =>
    Array.from({ length: count }, (_, k) => term(`${prefix}_${k + from}`))
  const unplaced = all('u', sessions.length)
  const late = deadline === null ? [] : all('late', sessions.length)
  const over = request.overBudget ? all('over', weeks.length, 1) : []
  const line = all('e', D, 1)
  const stay = placed.flatMap(({ own, options }) =>
    options.filter(({ d }) => d.day === own).map(({ v }) => term(v, -1)),
  )
  const early = all('t', sessions.length)
  const levels =
    deadline === null
      ? [unplaced, line, over, [term('Pw')], [term('Pd')], stay, early]
      : [unplaced, late, over, [term('Pw')], [term('Pd')], line, stay, early]
  return { model: { variables, constraints }, levels: levels.filter((level) => level.length > 0) }
}

/** The day of each session in a solution, `null` for one left out, and whether it lands on or after the deadline. */
export function readDays(
  values: Record<string, number>,
  room: Room,
  sessions: PlanEvent[],
): { days: (string | null)[]; late: boolean[] } {
  const days = sessions.map((_, i) => room.days.find((d) => (values[`y_${i}_${d.index}`] ?? 0) > 0.5)?.day ?? null)
  const { deadline } = room
  return { days, late: days.map((day) => day !== null && deadline !== null && day >= deadline) }
}
