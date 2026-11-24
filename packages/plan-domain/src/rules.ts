import { parseLocal, weekday } from './dates'
import { changedFields, type PlanDiff } from './diff'
import { overlapping } from './occurrences'
import { isSession } from './progress'
import type { Plan, PlanEvent } from './types'

/**
 * A rule of the plan that a change breaks. The guide states the rules for a model; these are the ones a program can
 * check. They warn and do not refuse: the person may want a session on a Saturday.
 */
export type RuleWarning =
  | { rule: 'holiday' | 'weekend'; event: PlanEvent }
  | { rule: 'overlap'; event: PlanEvent; other: PlanEvent }
  | { rule: 'deadline'; event: PlanEvent; deadline: PlanEvent }
  | { rule: 'done'; event: PlanEvent; removed: boolean }

const dayOf = (e: PlanEvent) => e.start.slice(0, 10)
const onWeekend = (e: PlanEvent) => weekday(parseLocal(e.start)) % 6 === 0
const sameSlot = (a: PlanEvent, b: PlanEvent) => a.start === b.start && a.end === b.end && a.calendar === b.calendar

/** The rules `diff` breaks in `after`, the plan it led to. Only what the change touched is checked. */
export function ruleWarnings(after: Plan, diff: PlanDiff): RuleWarning[] {
  const holidays = new Set(after.meta.holidays)
  const deadlines = after.events.filter((e) => e.kind === 'milestone')
  const previous = new Map(diff.changed.map((c) => [c.after.uid, c.before]))
  const warnings: RuleWarning[] = []
  const pairs = new Set<string>()

  for (const event of [...diff.added, ...diff.changed.map((c) => c.after)]) {
    const was = previous.get(event.uid)
    // A rename leaves the slot as it was: whatever it broke there is not news.
    if (!isSession(event) || (was && sameSlot(was, event))) continue
    if (holidays.has(dayOf(event))) warnings.push({ rule: 'holiday', event })
    if (onWeekend(event) && !(was && onWeekend(was))) warnings.push({ rule: 'weekend', event })
    for (const other of overlapping(after, { s: parseLocal(event.start), e: parseLocal(event.end) }, event.uid)) {
      const pair = [event.uid, other.uid].toSorted().join(' ')
      if (pairs.has(pair)) continue
      pairs.add(pair)
      warnings.push({ rule: 'overlap', event, other })
    }
    const deadline = deadlines.find((d) => d.calendar === event.calendar && event.end > d.start)
    if (deadline) warnings.push({ rule: 'deadline', event, deadline })
  }

  for (const { before, after: event } of diff.changed) {
    // Logging how long a finished session took is what finishing it asks for, not a change to it.
    const timeLogged = event.done === true && changedFields(before, event).every((field) => field === 'actual')
    if (before.done && !timeLogged) warnings.push({ rule: 'done', event, removed: false })
  }
  for (const event of diff.removed) if (event.done) warnings.push({ rule: 'done', event, removed: true })
  return warnings
}

/** A warning in words a model or a log can act on. The interface words them in the person's language itself. */
export function warningText(warning: RuleWarning): string {
  const { title, uid } = warning.event
  const named = `"${title}" (${uid})`
  switch (warning.rule) {
    case 'holiday':
      return `${named} falls on ${dayOf(warning.event)}, a holiday`
    case 'weekend':
      return `${named} falls on a weekend, ${dayOf(warning.event)}`
    case 'overlap':
      return `${named} shares its time with "${warning.other.title}" (${warning.other.uid})`
    case 'deadline':
      return `${named} ends after the deadline of its course, ${dayOf(warning.deadline)}`
    case 'done':
      return `${named} is already done and the update ${warning.removed ? 'removes' : 'changes'} it`
    default:
      return warning satisfies never
  }
}
