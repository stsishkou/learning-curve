import { DAY, HOUR, parseLocal, ymd } from '../core/dates'
import type { PlanEvent, SessionMove } from '../core/types'
import type { Room } from './room'
import type { RebalanceReason, RebalanceReport, RebalanceRequest } from './types'

export interface ReportInput {
  request: RebalanceRequest
  room: Room
  sessions: PlanEvent[]
  /** The slot of each session after the re-balance, in the order of `sessions`; null when it found none */
  slots: (SessionMove | null)[]
  moves: SessionMove[]
  provenBest: boolean
  gap: number
  budget: number
}

const round = (hours: number) => Math.round(hours * 100) / 100
const hoursOf = (slot: { start: string; end: string }) => (parseLocal(slot.end) - parseLocal(slot.start)) / HOUR

/** Runs of weeks next to each other, as first Monday and last Sunday. */
function runs(mondays: string[]): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = []
  for (const monday of mondays) {
    const last = out.at(-1)
    const t = parseLocal(`${monday}T00:00`)
    if (last && parseLocal(`${last.to}T00:00`) + DAY === t) last.to = ymd(t + 6 * DAY)
    else out.push({ from: monday, to: ymd(t + 6 * DAY) })
  }
  return out
}

/**
 * What the re-balance gives and why it cannot give more: the finish, the heaviest week and day, the weeks over the
 * budget, and the binding facts in the room (full weeks, days away, a deadline too close, a lab without a two-hour
 * block, the limit of the horizon, a search stopped by its time limit).
 */
export function reportOf(input: ReportInput): RebalanceReport {
  const { request, room, sessions, slots, moves, provenBest, gap, budget } = input
  const placed = slots.filter((slot) => slot !== null)
  const days = placed.map((slot) => slot.start.slice(0, 10))
  const finish = days.length ? days.reduce((a, b) => (b > a ? b : a)) : null
  const { deadline } = room
  const late = deadline === null ? 0 : days.filter((day) => day >= deadline).length
  const unplaced = slots.length - placed.length

  const weekOf = new Map(room.days.map((d) => [d.day, d.week]))
  const perWeek = new Map<string, number>()
  const perDay = new Map<string, number>()
  for (const slot of placed) {
    const day = slot.start.slice(0, 10)
    const week = weekOf.get(day)
    if (week !== undefined) perWeek.set(week, (perWeek.get(week) ?? 0) + hoursOf(slot))
    perDay.set(day, (perDay.get(day) ?? 0) + hoursOf(slot))
  }
  const weeks = [...room.weeks].map(([week, { fixed }]) => ({ week, hours: fixed + (perWeek.get(week) ?? 0) }))
  const overWeeks = weeks
    .filter((w) => w.hours > budget + 1e-6)
    .map((w) => ({ week: w.week, hours: round(w.hours - budget) }))

  const reasons: RebalanceReason[] = []
  if (!sessions.length) reasons.push({ kind: 'nothing-to-move' })
  const until = finish ?? room.days.at(-1)?.day ?? request.from
  if (!request.overBudget) {
    const full = [...room.weeks]
      .filter(([week, { left }]) => left <= 1e-9 && week <= until)
      .map(([week]) => week)
      .toSorted()
    for (const run of runs(full)) reasons.push({ kind: 'full-weeks', ...run })
  }
  const away = room.daysOff.filter((day) => day <= until)
  if (away.length) reasons.push({ kind: 'days-off', days: away })
  if (late && deadline !== null) {
    reasons.push({ kind: 'late', placed: placed.length - late, total: sessions.length, deadline })
  }
  const left = sessions.filter((_, i) => slots[i] === null)
  const lab = room.days.some((d) => d.lab) ? undefined : left.find((e) => e.kind === 'lab')
  if (lab) reasons.push({ kind: 'no-lab-block', title: lab.title })
  if (left.some((e) => e !== lab)) reasons.push({ kind: 'limit' })
  if (!provenBest) reasons.push({ kind: 'not-proven', gap })

  return {
    finish,
    finishBefore: sessions.at(-1)?.start.slice(0, 10) ?? null,
    deadline,
    peakWeek: round(weeks.reduce((peak, w) => Math.max(peak, w.hours), 0)),
    peakDay: round([...perDay.values()].reduce((peak, h) => Math.max(peak, h), 0)),
    overWeeks,
    moved: moves.length,
    late,
    unplaced,
    provenBest,
    reasons,
  }
}
