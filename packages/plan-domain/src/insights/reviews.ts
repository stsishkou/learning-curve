import type { NewEvent } from '../core/changes'
import { DAY, HOUR, parseLocal, startOfDay, toLocalString, ymd } from '../core/dates'
import { occurrences } from '../core/occurrences'
import { isDone, isSession } from '../core/progress'
import type { Plan, PlanEvent } from '../core/types'

/** Days after a module is finished on which it is reviewed: the gaps grow, as spaced repetition asks. */
export const REVIEW_GAPS = [1, 3, 7]
/** A review is short on purpose: recall first, then a look at the material. */
const REVIEW_LENGTH = HOUR / 2
const STEP = HOUR / 2
/** A review is not put before or after these hours of a day */
const EARLIEST = 8 * HOUR
const LATEST = 21 * HOUR
/** A module finished longer ago than this is not offered: its first review would already be late */
const OFFER_FOR = 14 * DAY
const NO_CALENDARS: ReadonlySet<string> = new Set()

const COUNTER = / \(\d+\/\d+\)$/
const moduleOf = (e: PlanEvent) => e.title.replace(COUNTER, '')
const reviewPrefix = (module: string) => module.replace(/^([^—]+— )?/, '$1Повтор: ')
/** `Course: https://…`, `Module: https://…`: the lines of a description that say where the material is */
const LINK_LINE = /^(\S+: )?https?:\/\/\S+$/

/** Reviews to plan for one module that is done. */
export interface ReviewOffer {
  /** Names the module across reloads: its calendar and its title */
  key: string
  calendar: string
  /** The module's title without the course name and the counter */
  title: string
  /** The review sessions, ready to be added */
  reviews: NewEvent[]
}

/** The first half hour of `day` that is free of busy events, looked for from `preferred` (ms into the day) on. */
function freeSlot(plan: Plan, day: number, preferred: number, taken: number[]): number {
  const busy = occurrences(plan, day, day + DAY, NO_CALENDARS).filter((o) => !o.allDay && o.availability !== 'free')
  const free = (s: number) =>
    !busy.some((o) => o.s < s + REVIEW_LENGTH && s < o.e) && !taken.some((t) => t < s + REVIEW_LENGTH && s < t + STEP)
  const from = Math.max(EARLIEST, Math.min(preferred, LATEST - REVIEW_LENGTH))
  for (let at = from; at + REVIEW_LENGTH <= LATEST; at += STEP) if (free(day + at)) return day + at
  for (let at = from - STEP; at >= EARLIEST; at -= STEP) if (free(day + at)) return day + at
  return day + from
}

/**
 * The modules that were just finished and have no reviews yet, each with three short review sessions on days 1,
 * 3 and 7 from today, in the module's calendar. A review takes the first free half hour of its day, looked for
 * from the hour the module's sessions used to end; a day off is skipped. Reviews are sessions like any other:
 * they count toward the weekly budget and can be marked done.
 */
export function reviewOffers(plan: Plan, now: number): ReviewOffer[] {
  const today = startOfDay(now)
  const modules = new Map<string, PlanEvent[]>()
  for (const e of plan.events) {
    if (!isSession(e) || e.kind === 'review') continue
    const key = `${e.calendar}\n${moduleOf(e)}`
    modules.set(key, [...(modules.get(key) ?? []), e])
  }
  const reviewed = new Set(plan.events.filter((e) => e.kind === 'review').map((e) => `${e.calendar}\n${moduleOf(e)}`))

  const offers: ReviewOffer[] = []
  for (const [key, sessions] of modules) {
    const last = sessions.reduce((latest, e) => (e.end > latest.end ? e : latest))
    const module = moduleOf(last)
    // A module whose sessions were all skipped was not studied: there is nothing to review.
    if (!sessions.every((e) => e.done) || !sessions.some(isDone)) continue
    if (parseLocal(last.end) < today - OFFER_FOR) continue
    if (reviewed.has(`${last.calendar}\n${reviewPrefix(module)}`)) continue

    const preferred = parseLocal(last.end) - startOfDay(parseLocal(last.end))
    const links = last.description.split('\n').filter((line) => LINK_LINE.test(line.trim()))
    const taken: number[] = []
    const reviews = REVIEW_GAPS.map((gap, i): NewEvent => {
      let day = today + gap * DAY
      while (plan.meta.holidays.includes(ymd(day))) day += DAY
      const start = freeSlot(plan, day, preferred, taken)
      taken.push(start)
      return {
        calendar: last.calendar,
        title: `${reviewPrefix(module)} (${i + 1}/${REVIEW_GAPS.length})`,
        description: [
          ...links,
          'Вспомнить ключевые идеи модуля по памяти, затем свериться с материалом.',
          'Done: пересказ модуля без подсказок.',
        ].join('\n'),
        start: toLocalString(start),
        end: toLocalString(start + REVIEW_LENGTH),
        availability: 'busy',
      }
    })
    offers.push({ key, calendar: last.calendar, title: module.replace(/^[^—]+— /, ''), reviews })
  }
  return offers
}
