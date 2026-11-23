import { CALENDARS, CERT1, CERT2, HFAGENTS, HFLLM, PRACTICALPY } from './content'
import { DAY, addDays, parseLocal, weekday } from './dates'
import type { Plan, PlanEvent, QueueItem } from './types'

export interface ScheduleConfig {
  timezone: string
  weeklyBudgetHours: number
  /** Days with no study sessions */
  holidays: string[]
  /** Certificates: weekdays 12:00–14:00 inside this range */
  certStart: string
  certEnd: string
  certDeadline: string
  /** Courses resume on this date */
  coursesStart: string
  /** First Saturday with a buffer slot */
  bufferStart: string
  /** First gym session (recurring Tue/Thu 08:30–10:30) */
  gymStart: string
}

export const DEFAULT_CONFIG: ScheduleConfig = {
  timezone: 'Europe/Minsk',
  weeklyBudgetHours: 12,
  holidays: ['2026-12-25', '2026-12-31', '2027-01-01', '2027-01-07'],
  certStart: '2026-11-23',
  certEnd: '2026-12-30',
  certDeadline: '2026-12-30',
  coursesStart: '2027-01-04',
  bufferStart: '2026-11-28',
  gymStart: '2026-11-24',
}

const pad = (n: number) => String(n).padStart(2, '0')
const at = (day: string, h: number, m = 0) => `${day}T${pad(h)}:${pad(m)}`

const dow = (s: string) => weekday(parseLocal(s))

export function buildPlan(
  config: ScheduleConfig = DEFAULT_CONFIG,
  generated = new Date().toISOString().slice(0, 10),
): Plan {
  const holidays = new Set(config.holidays)
  const isWorkday = (s: string) => dow(s) >= 1 && dow(s) <= 5 && !holidays.has(s)

  const events: PlanEvent[] = []
  const counters: Record<string, number> = {}
  const push = (calendar: string, item: QueueItem, start: string, end: string, extra: Partial<PlanEvent> = {}) => {
    counters[calendar] = (counters[calendar] ?? 0) + 1
    events.push({
      uid: `${calendar}-${String(counters[calendar]).padStart(3, '0')}@learning-curve`,
      calendar,
      title: item.title,
      start,
      end,
      description: item.description,
      kind: item.kind,
      availability: item.availability ?? 'busy',
      ...extra,
    })
  }

  // ---- Certificates: weekdays 12:00–14:00, labs need the whole 2 h block ----
  const certQueue = [...CERT1, ...CERT2]
  let lastCertDay: string | null = null
  for (let day = config.certStart; day <= config.certEnd && certQueue.length; day = addDays(day, 1)) {
    if (!isWorkday(day)) continue
    let hour = 12
    while (hour < 14) {
      const next = certQueue[0]
      if (!next) break
      if (next.hours === 2 && hour === 13) {
        // A lab cannot start at 13:00: pull the next 1 h session forward, run the lab the next day at 12:00.
        const j = certQueue.findIndex((x) => x.hours === 1)
        const [one] = j > 0 ? certQueue.splice(j, 1) : []
        if (one) {
          push('certs', one, at(day, 13), at(day, 14))
          lastCertDay = day
        }
        hour = 14
        continue
      }
      certQueue.shift()
      push('certs', next, at(day, hour), at(day, hour + next.hours))
      hour += next.hours
      lastCertDay = day
    }
  }
  if (certQueue.length)
    throw new Error(`Certificates do not fit before ${config.certEnd}: ${certQueue.length} sessions left`)
  push(
    'certs',
    {
      title: 'Дедлайн: оба сертификата Google Partner',
      hours: 1,
      kind: 'milestone',
      availability: 'free',
      description: 'Оба сертификата (3 + 3 challenge-лабы) должны быть получены до этой даты.',
    },
    at(config.certDeadline, 0),
    at(config.certDeadline, 0),
    { allDay: true },
  )

  // ---- Courses: 11:00 HF LLM → Practical Python; 12:00 HF Agents; 13:00 Mon/Wed Practical Python ----
  const llm = [...HFLLM]
  const agents = [...HFAGENTS]
  const py = [...PRACTICALPY]
  let lastDay = config.coursesStart
  for (let day = config.coursesStart; llm.length || agents.length || py.length; day = addDays(day, 1)) {
    if (!isWorkday(day)) continue
    if (llm.length) push('hfllm', llm.shift()!, at(day, 11), at(day, 12))
    else if (py.length) push('pypy', py.shift()!, at(day, 11), at(day, 12))
    if (agents.length) push('hfagents', agents.shift()!, at(day, 12), at(day, 13))
    if ((dow(day) === 1 || dow(day) === 3) && py.length) push('pypy', py.shift()!, at(day, 13), at(day, 14))
    lastDay = day
  }

  // ---- Saturday buffer: free time, does not block and does not count toward the budget ----
  for (let s = config.bufferStart; s <= addDays(lastDay, 6); s = addDays(s, 7)) {
    if (s > config.certEnd && s < config.coursesStart) continue
    push(
      'journey',
      {
        title: 'Буфер — догнать отставание',
        hours: 2,
        kind: 'buffer',
        availability: 'free',
        description: 'Резерв на случай отставания. Если всё по плану — свободное время.',
      },
      at(s, 10),
      at(s, 12),
    )
  }

  // ---- Personal: gym, recurring ----
  push(
    'personal',
    { title: 'Спортзал', hours: 2, kind: 'personal', description: '' },
    at(config.gymStart, 8, 30),
    at(config.gymStart, 10, 30),
    { rrule: 'FREQ=WEEKLY;BYDAY=TU,TH' },
  )

  events.sort((a, b) => a.start.localeCompare(b.start) || a.calendar.localeCompare(b.calendar))

  return {
    meta: {
      title: 'AI Agent Engineer',
      version: 1,
      timezone: config.timezone,
      generated,
      weeklyBudgetHours: config.weeklyBudgetHours,
      certDeadline: config.certDeadline,
      holidays: config.holidays,
      lastCertDay,
      planEnd: lastDay,
    },
    calendars: CALENDARS,
    events,
  }
}

/** Busy study hours per week (Monday key), for checks against the budget. */
export function weeklyHours(plan: Plan): Record<string, number> {
  const weeks: Record<string, number> = {}
  for (const e of plan.events) {
    if (e.allDay || e.rrule || e.availability === 'free') continue
    const t = parseLocal(e.start)
    const monday = t - ((weekday(t) + 6) % 7) * DAY
    const key = new Date(monday).toISOString().slice(0, 10)
    weeks[key] = (weeks[key] ?? 0) + (parseLocal(e.end) - t) / 3_600_000
  }
  return weeks
}
