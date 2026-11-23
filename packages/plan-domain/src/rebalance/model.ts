import { HOUR, parseLocal } from '../dates'
import type { PlanEvent } from '../types'
import type { LpConstraint, LpModel, LpTerm, LpVariable } from './lp'
import type { Room } from './room'
import type { RebalanceRequest } from './types'

const hoursOf = (e: PlanEvent) => (parseLocal(e.end) - parseLocal(e.start)) / HOUR
/** The room a session takes: its length rounded up to the half-hour grid */
const roomOf = (e: PlanEvent) => Math.ceil(hoursOf(e) * 2 - 1e-9) / 2
const term = (v: string, c = 1): LpTerm => ({ v, c })
const EPSILON = 1e-9
/** Study days the model keeps after the furthest day a session aims at, so the levels after the rhythm can move */
const MARGIN = 10
/** Halvings of the gap when looking for the slowest rhythm that meets a deadline: far finer than a day */
const HALVINGS = 40
const placedCount = (days: (number | null)[]) => days.filter((d) => d !== null).length

/**
 * Sessions in order, each on the first study day it fits from where a rhythm puts it. The rhythm starts at study day
 * `anchor` (a position in `room.days`) and puts each session `gap` study days after the one before it; a fraction
 * carries over, so a gap of 2/3 gives two sessions, one, two, one. A session fits by the model's own rules: the day's
 * room (or its own day, for a session outside the study hours), one lab a day, and the week's room unless going over
 * is allowed. When a session has to wait for room, the rhythm starts again from the day it lands on: a stretch
 * without room is never made up for with a crunch after it.
 *
 * Returns the index of each session's day, or null for a session that finds none; the sessions after it find none
 * either, as the model leaves out only the tail of a course.
 */
export function rhythmDays(
  room: Room,
  sessions: PlanEvent[],
  request: RebalanceRequest,
  gap: number,
  anchor = 0,
): (number | null)[] {
  const used = new Map<number, number>()
  const labs = new Set<number>()
  const weeks = new Map<string, number>()
  const out: (number | null)[] = []
  let previous = 0
  let next = anchor
  for (const e of sessions) {
    const own = room.own.get(e.uid)
    const keep = own?.outside ? own.day : null
    const aim = Math.floor(next + EPSILON)
    const at =
      out.at(-1) === null
        ? -1
        : room.days.findIndex((d, k) => {
            if (k < Math.max(previous, aim)) return false
            const outside = d.day === keep
            const lab = e.kind !== 'lab' || ((outside || d.lab) && !labs.has(d.index))
            const fits = outside || (used.get(d.index) ?? 0) + roomOf(e) <= d.cap + EPSILON
            const week =
              request.overBudget ||
              (weeks.get(d.week) ?? 0) + hoursOf(e) <= (room.weeks.get(d.week)?.left ?? 0) + EPSILON
            return lab && fits && week
          })
    const day = room.days[at]
    if (!day) {
      out.push(null)
      continue
    }
    next = (at === aim ? next : at) + gap
    previous = at
    if (day.day !== keep) used.set(day.index, (used.get(day.index) ?? 0) + roomOf(e))
    if (e.kind === 'lab') labs.add(day.index)
    weeks.set(day.week, (weeks.get(day.week) ?? 0) + hoursOf(e))
    out.push(day.index)
  }
  return out
}

/**
 * The earliest study day (its index) each session can reach, or null for none: the rhythm without a gap, each
 * session on the first day from the one before it where it fits.
 *
 * In any placement the model allows, no session is earlier than this: the sessions before it are each no earlier
 * than theirs, so on every day it skips they would leave it even less room. The model builds nothing before it.
 * Towards a deadline it is also the most sessions that can finish in time.
 */
export const earliestDays = (room: Room, sessions: PlanEvent[], request: RebalanceRequest): (number | null)[] =>
  rhythmDays(room, sessions, request, 0)

/**
 * The study day each session aims at (its index), null for a session the rhythm cannot place.
 *
 * - At a pace: the rhythm asked for, from the course's first session: one every `1 / perDay` study days. A
 *   re-balance changes the rhythm, not where the course starts; a first session already past starts again today.
 * - Towards a deadline: the slowest such rhythm that still has every session before the deadline, found by halving
 *   the gap. It starts at the course's first session, or at the first day when that lets it run slower. It keeps to
 *   the budget whenever that still finishes in time, as going over serves only to be in time. When even the earliest
 *   placement cannot finish in time, the targets are that placement, as nothing finishes sooner.
 */
export function targetDays(room: Room, sessions: PlanEvent[], request: RebalanceRequest): (number | null)[] {
  const first = sessions[0]?.start.slice(0, 10) ?? ''
  const anchor = Math.max(
    0,
    room.days.findIndex((d) => d.day >= first),
  )
  if (request.target.mode === 'pace') return rhythmDays(room, sessions, request, 1 / request.target.perDay, anchor)

  const { deadline } = room
  if (deadline === null) return earliestDays(room, sessions, request)
  const dayOf = new Map(room.days.map((d) => [d.index, d.day]))
  const inTime = (days: (number | null)[]) => days.every((d) => d !== null && (dayOf.get(d) ?? deadline) < deadline)
  const within = { ...request, overBudget: false }
  const rules = inTime(earliestDays(room, sessions, within)) ? within : request
  const earliest = earliestDays(room, sessions, rules)
  if (!inTime(earliest)) return earliest
  const slowestFrom = (start: number) => {
    if (!inTime(rhythmDays(room, sessions, rules, 0, start))) return -1
    let slowest = 0
    let tooSlow = Math.max(1, room.days.filter((d) => d.day < deadline).length)
    for (let step = 0; step < HALVINGS; step++) {
      const gap = (slowest + tooSlow) / 2
      if (inTime(rhythmDays(room, sessions, rules, gap, start))) slowest = gap
      else tooSlow = gap
    }
    return slowest
  }
  const kept = slowestFrom(anchor)
  const fromFirst = anchor === 0 ? kept : slowestFrom(0)
  return fromFirst > kept + EPSILON
    ? rhythmDays(room, sessions, rules, fromFirst, 0)
    : rhythmDays(room, sessions, rules, kept, anchor)
}

/**
 * The room the model needs. Towards a deadline every session can meet, the days before it: only being left out ranks
 * above being late, so no best answer uses a later day. Otherwise the days up to a few after the furthest a session
 * aims at or can first reach, which leaves the levels after the rhythm room to move.
 */
export function reachOf(room: Room, sessions: PlanEvent[], request: RebalanceRequest): Room {
  const earliest = earliestDays(room, sessions, request)
  const { deadline } = room
  if (request.target.mode === 'deadline' && deadline !== null) {
    const before = room.days.filter((d) => d.day < deadline)
    const last = before.at(-1)?.index ?? 0
    if (earliest.every((index) => index !== null && index <= last)) return { ...room, days: before }
  }
  const furthest = Math.max(0, ...[...earliest, ...targetDays(room, sessions, request)].filter((i) => i !== null))
  const after = room.days.findIndex((d) => d.index > furthest)
  return after === -1 ? room : { ...room, days: room.days.slice(0, after + MARGIN) }
}

/**
 * Step 2 of a re-balance: which session goes on which study day, as an integer program solved level by level.
 * `docs/rebalancing.md` explains every row; in short:
 *
 * - `y_i_d` (binary) puts session `i` on study day `d`; it exists only where the session fits, so most of the
 *   matrix is never built. `u_i` leaves it out; left-out sessions are always the tail of the course.
 * - `Y_i_d` is 1 once session `i` is placed on day `d` or before, a running sum of its `y`. `Y_{i+1,d} ≤ Y_{i,d}`
 *   keeps the order: the precedence written with prefix sums, at three nonzeros a row. A big-M order on day indices
 *   is smaller, but its relaxation is so weak that the solver cannot place a real course within its time limit.
 * - `t_i` is the index of its day, for the last tie-break.
 * - `L_d` is the load of day `d`; `over_w` the week's load over its room, a variable only when the person allows it.
 * - `Pw`, `Pd` are the heaviest week (everything that counts) and the calendar's heaviest day.
 * - The rhythm is a cost on each `y`: the session's hours for every study day between `d` and the day it aims at
 *   (`targetDays`). Written on `y` itself, it needs no running sums and the solver closes it at once.
 *
 * The solver starts from the target placement, or from the earliest one when the targets leave a session out.
 * Variables are named by index, not uid, so the names stay valid in an LP file.
 */
export function buildModel(
  room: Room,
  sessions: PlanEvent[],
  request: RebalanceRequest,
): { model: Omit<LpModel, 'objective'>; levels: LpTerm[][]; start: Record<string, number> } {
  const variables: LpVariable[] = []
  const constraints: LpConstraint[] = []
  const binary = (name: string) => variables.push({ name, kind: 'binary', lower: 0, upper: 1 })
  const continuous = (name: string, upper: number | null = null) =>
    variables.push({ name, kind: 'continuous', lower: 0, upper })
  const row = (name: string, terms: LpTerm[], op: LpConstraint['op'], rhs: number) =>
    constraints.push({ name, terms, op, rhs })

  const D = room.days.length
  const deadline = request.target.mode === 'deadline' ? room.deadline : null

  // Where each session may go.
  const earliest = earliestDays(room, sessions, request)
  const targets = targetDays(room, sessions, request)
  const placed = sessions.map((e, i) => {
    const own = room.own.get(e.uid)
    const keep = own?.outside ? own.day : null
    const first = earliest[i] ?? Number.POSITIVE_INFINITY
    const options = room.days
      .filter((d) => d.index >= first)
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
  for (const [i] of sessions.entries()) for (const d of room.days) continuous(`Y_${i}_${d.index}`, 1)
  for (const d of room.days) continuous(`L_${d.index}`)
  const weeks = [...new Set(room.days.map((d) => d.week))]
  if (request.overBudget) for (const [w] of weeks.entries()) continuous(`over_${w + 1}`)
  continuous('Pw')
  continuous('Pd')

  for (const { i, options } of placed) {
    const on = new Map(options.map((o) => [o.d.index, o.v]))
    for (const { index: d } of room.days) {
      const y = on.get(d)
      row(
        `reach_${i}_${d}`,
        [term(`Y_${i}_${d}`), ...(d > 1 ? [term(`Y_${i}_${d - 1}`, -1)] : []), ...(y ? [term(y, -1)] : [])],
        '=',
        0,
      )
      if (i + 1 < sessions.length) row(`order_${i}_${d}`, [term(`Y_${i + 1}_${d}`), term(`Y_${i}_${d}`, -1)], '<=', 0)
    }
    row(`once_${i}`, [...(D ? [term(`Y_${i}_${room.days.at(-1)?.index ?? D}`)] : []), term(`u_${i}`)], '=', 1)
    row(`day_${i}`, [term(`t_${i}`), ...options.map(({ d, v }) => term(v, -d.index))], '=', 0)
    if (i + 1 < sessions.length) row(`tail_${i}`, [term(`u_${i}`), term(`u_${i + 1}`, -1)], '<=', 0)
    if (deadline !== null) {
      const after = options.filter(({ d }) => d.day >= deadline).map(({ v }) => term(v, -1))
      row(`late_${i}`, [term(`late_${i}`), ...after], '=', 0)
    }
  }

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
  const rhythm = placed.flatMap(({ i, options }) => {
    const target = targets[i] ?? null
    return target === null
      ? []
      : options.map(({ d, v, e }) => term(v, hoursOf(e) * Math.abs(d.index - target))).filter(({ c }) => c > 0)
  })
  const stay = placed.flatMap(({ own, options }) =>
    options.filter(({ d }) => d.day === own).map(({ v }) => term(v, -1)),
  )
  const early = all('t', sessions.length)
  const levels =
    deadline === null
      ? [unplaced, rhythm, over, [term('Pw')], [term('Pd')], stay, early]
      : [unplaced, late, over, rhythm, [term('Pw')], [term('Pd')], stay, early]
  return {
    model: { variables, constraints },
    levels: levels.filter((level) => level.length > 0),
    start: startOf(variables, placedCount(targets) === placedCount(earliest) ? targets : earliest, {
      room,
      sessions,
      request,
      weeks,
    }),
  }
}

/** Every variable's value for a placement of the sessions on day indices (null: left out). */
function startOf(
  variables: LpVariable[],
  days: (number | null)[],
  context: { room: Room; sessions: PlanEvent[]; request: RebalanceRequest; weeks: string[] },
): Record<string, number> {
  const { room, sessions, request, weeks } = context
  const deadline = request.target.mode === 'deadline' ? room.deadline : null
  const values: Record<string, number> = Object.fromEntries(variables.map((v) => [v.name, 0]))
  const load = new Map<number, number>()
  for (const [i, e] of sessions.entries()) {
    const index = days[i] ?? null
    if (index === null) {
      values[`u_${i}`] = 1
      continue
    }
    values[`y_${i}_${index}`] = 1
    values[`t_${i}`] = index
    for (const d of room.days) if (d.index >= index) values[`Y_${i}_${d.index}`] = 1
    const day = room.days.find((d) => d.index === index)?.day ?? ''
    if (deadline !== null && day >= deadline) values[`late_${i}`] = 1
    load.set(index, (load.get(index) ?? 0) + hoursOf(e))
  }
  for (const d of room.days) {
    const hours = load.get(d.index) ?? 0
    values[`L_${d.index}`] = hours
    values.Pd = Math.max(values.Pd ?? 0, hours)
  }
  for (const [w, week] of weeks.entries()) {
    const hours = room.days.filter((d) => d.week === week).reduce((total, d) => total + (load.get(d.index) ?? 0), 0)
    const { left = 0, fixed = 0 } = room.weeks.get(week) ?? {}
    if (request.overBudget) values[`over_${w + 1}`] = Math.max(0, hours - left)
    values.Pw = Math.max(values.Pw ?? 0, fixed + hours)
  }
  return values
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
