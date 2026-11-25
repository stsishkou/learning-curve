import type { NewSession, PlanChange } from './changes'
import { DAY, HOUR, mondayOf, parseLocal, toLocalString, weekday, ymd } from './dates'
import { occurrences } from './occurrences'
import { studyHoursOn } from './rules'
import { weeklyHours } from './schedule'
import type { Plan } from './types'

/** One module of a pasted course: its title, its length when the list gave one, and whether it is a lab. */
export interface CourseModule {
  title: string
  minutes: number | null
  lab: boolean
}

const HOURS = String.raw`(\d+(?:[.,]\d+)?)\s*(?:h|hrs?|hours?|ч|час(?:а|ов)?)\.?`
const MINUTES = String.raw`(\d+)\s*(?:m|mins?|minutes?|мин(?:ут[аы]?)?)\.?`
const LENGTH = String.raw`(?:${HOURS})?\s*(?:${MINUTES})?`
const LENGTH_ONLY = new RegExp(`^${LENGTH}$`, 'i')
// "Title — 2h 30m", "Title: 90 min", "Title - 2 hours", "Title (1h)".
const TITLE_AND_LENGTH = new RegExp(String.raw`^(.*?\S)\s*(?:[—–|:\t]|\s-)\s*(${LENGTH})$`, 'i')
const TITLE_PAREN_LENGTH = new RegExp(String.raw`^(.*?\S)\s*\((${LENGTH})\)$`, 'i')
// The lines a Google Skills path puts around its titles: the type of an item, its icon's name, its progress.
const NOISE = /^(?:\d+\s*%|course|pace|award_star|completed|in progress|not started|\S+ icon\s*\S+)$/i
// A skill badge is the hands-on lab that ends a course.
const LAB_MARK = /^(?:skill badge|lab|lab icon\s*lab)$/i
const LAB_PREFIX = /^(?:lab|лаба|skill badge)\s*[:—–-]\s*/i
const BULLET = /^[-*•]\s+/

function minutesOf(text: string): number | null {
  const match = LENGTH_ONLY.exec(text.trim())
  if (!match || (match[1] === undefined && match[2] === undefined)) return null
  return Math.round(Number((match[1] ?? '0').replace(',', '.')) * 60) + Number(match[2] ?? 0)
}

function titleAndLength(line: string): [string, number | null] {
  const match = TITLE_AND_LENGTH.exec(line) ?? TITLE_PAREN_LENGTH.exec(line)
  const minutes = match?.[2] === undefined ? null : minutesOf(match[2])
  return match?.[1] !== undefined && minutes !== null ? [match[1], minutes] : [line, null]
}

/**
 * The modules of a course from pasted text: a Google Skills path copied from its page (a title line, then a length
 * line such as "2 hours 30 minutes"; "Skill badge" before a title makes it a lab), or one module per line
 * ("Title — 2h 30m", "Lab: Title — 2h"). A module whose length is not given has none.
 */
export function parseModules(text: string): CourseModule[] {
  const modules: CourseModule[] = []
  let lab = false
  // A length on a line of its own belongs to the title above it.
  let waiting: CourseModule | null = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(BULLET, '')
    if (!line) continue
    if (LAB_MARK.test(line)) {
      lab = true
      continue
    }
    if (NOISE.test(line)) continue
    const alone = minutesOf(line)
    if (alone !== null) {
      if (waiting) waiting.minutes = alone
      waiting = null
      continue
    }
    const [title, minutes] = titleAndLength(line)
    const module: CourseModule = {
      title: title.replace(LAB_PREFIX, '').trim(),
      minutes,
      lab: lab || LAB_PREFIX.test(title),
    }
    lab = false
    modules.push(module)
    waiting = minutes === null ? module : null
  }
  return modules
}

/** What the New course form asks for. */
export interface CourseInput {
  /** The calendar's name */
  name: string
  /** The course's name in session titles; the calendar's name when empty */
  short: string
  color: string
  labels: string[]
  /** The course's page, written into every session's description; may be empty */
  link: string
  modules: CourseModule[]
  /** The first day a session may take, `YYYY-MM-DD` */
  firstDay: string
  /** The days of the week sessions go on, 0 Sunday … 6 Saturday */
  weekdays: number[]
  /** When the first session of a day starts, `HH:MM`; the next ones follow it */
  start: string
  /** How many sessions a day holds at most; a lab counts as one */
  perDay: number
  /** The course's deadline, `YYYY-MM-DD`; null for none */
  deadline: string | null
}

/** A course turned into sessions, ready to add. */
export interface CoursePlan {
  change: Extract<PlanChange, { type: 'course.add' }>
  /** Sessions with no room in the year after the first day: they are left out */
  unplaced: number
}

/** A session never runs past this hour. */
const DAY_END = 22
const STEP = HOUR / 2
const SEARCH_DAYS = 366
const LAB_HOURS = 2
const NO_CALENDARS: ReadonlySet<string> = new Set()

interface Block {
  title: string
  description: string
  hours: number
  lab: boolean
}

/** The hours a module takes in the plan: two for a lab, otherwise its length rounded up, an hour when not given. */
export function moduleHours({ minutes, lab }: CourseModule): number {
  return lab ? LAB_HOURS : Math.max(1, Math.ceil((minutes ?? 60) / 60))
}

const spoken = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours ? `${hours} ч` : '', rest ? `${rest} мин` : ''].filter(Boolean).join(' ')
}

/** The sessions of a course in order, titled and described as the guide asks. Plan content is Russian. */
function courseBlocks(input: CourseInput): Block[] {
  const short = input.short.trim() || input.name.trim()
  const link = input.link.trim()
  const describe = (goal: string) => [link ? `Course: ${link}` : '', goal].filter(Boolean).join('\n')
  const blocks: Block[] = []
  let labs = 0
  for (const module of input.modules) {
    const { title, minutes, lab } = module
    const length = minutes === null ? '' : ` (${spoken(minutes)})`
    if (lab) {
      labs += 1
      blocks.push({
        title: `${short} — Лаба ${labs}: ${title}`,
        description: describe(`${title}${length}: один блок без перерыва.`),
        hours: moduleHours(module),
        lab: true,
      })
      continue
    }
    const parts = moduleHours(module)
    for (let part = 1; part <= parts; part++) {
      blocks.push({
        title: parts > 1 ? `${short} — ${title} (${part}/${parts})` : `${short} — ${title}`,
        description: describe(parts > 1 ? `${title}${length}, часть ${part} из ${parts}.` : `${title}${length}.`),
        hours: 1,
        lab: false,
      })
    }
  }
  return blocks
}

function clockOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * HOUR + minutes * 60_000
}

/** The first start from `from` on, in half-hour steps, that leaves `length` clear of `taken` and ends by `end`. */
function firstFree(from: number, length: number, taken: { s: number; e: number }[], end: number): number | null {
  for (let s = Math.ceil(from / STEP) * STEP; s + length <= end; s += STEP) {
    if (!taken.some((t) => t.s < s + length && s < t.e)) return s
  }
  return null
}

/**
 * A new course as one `course.add`: a session an hour of every module, the length rounded up to whole hours and
 * the parts numbered, a lab one two-hour block. Sessions go in order on the chosen weekdays from the first day,
 * from the start time on, only where the time is free, never on a holiday, never past the weekly budget or the day
 * limit, and never before `now`. The deadline, when given, comes as the course's milestone.
 */
export function planCourse(plan: Plan, input: CourseInput, now: number): CoursePlan {
  const blocks = courseBlocks(input)
  const { weeklyBudgetHours: budget, dayLimit, holidays } = plan.meta
  const planned = weeklyHours(plan)
  const added = new Map<string, number>()
  const off = new Set(holidays)
  const first = parseLocal(`${input.firstDay}T00:00`)
  const sessions: NewSession[] = []
  let next = 0

  for (let day = first; next < blocks.length && day < first + SEARCH_DAYS * DAY; day += DAY) {
    if (!input.weekdays.includes(weekday(day)) || off.has(ymd(day))) continue
    const week = ymd(mondayOf(day))
    const taken = occurrences(plan, day, day + DAY, NO_CALENDARS)
      .filter((o) => !o.allDay && o.availability !== 'free')
      .map(({ s, e }) => ({ s, e }))
    let studied = dayLimit === undefined ? 0 : studyHoursOn(plan, ymd(day))
    let from = Math.max(day + clockOf(input.start), now)
    for (let count = 0; count < input.perDay; count++) {
      const block = blocks[next]
      if (!block) break
      const inWeek = added.get(week) ?? 0
      if ((planned[week] ?? 0) + inWeek + block.hours > budget) break
      if (dayLimit !== undefined && studied + block.hours > dayLimit) break
      const s = firstFree(from, block.hours * HOUR, taken, day + DAY_END * HOUR)
      if (s === null) break
      const e = s + block.hours * HOUR
      const session: NewSession = {
        title: block.title,
        start: toLocalString(s),
        end: toLocalString(e),
        description: block.description,
        availability: 'busy',
      }
      if (block.lab) session.kind = 'lab'
      sessions.push(session)
      taken.push({ s, e })
      added.set(week, inWeek + block.hours)
      studied += block.hours
      from = e
      next += 1
    }
  }

  if (input.deadline) {
    const midnight = `${input.deadline}T00:00`
    sessions.push({
      title: `Дедлайн: ${input.name.trim()}`,
      start: midnight,
      end: midnight,
      description: '',
      availability: 'free',
      kind: 'milestone',
    })
  }
  const labels = input.labels.filter((label) => label.trim())
  return {
    change: {
      type: 'course.add',
      name: input.name.trim(),
      color: input.color,
      sessions,
      ...(labels.length ? { labels } : {}),
    },
    unplaced: blocks.length - next,
  }
}
