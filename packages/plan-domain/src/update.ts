import { PlanChangeError, applyChange, parseChange, type PlanChange } from './changes'
import { diffPlans, type PlanDiff } from './diff'
import { applyEdits, emptyEdits, isRecord } from './edits'
import { weeklyHours } from './schedule'
import { UPDATE_CHANGE_TYPES, UPDATE_FORMAT } from './schema'
import type { Plan, PlanCalendar, PlanEvent } from './types'

/** Changes to a plan as a chat or a tool returns them: the document `UPDATE_SCHEMA` describes. */
export interface PlanUpdate {
  format: typeof UPDATE_FORMAT
  /** What the update does, in the words of whoever wrote it; empty when they gave none */
  summary: string
  changes: PlanChange[]
}

const CHANGES_MAX = 200
const ALLOWED: readonly string[] = UPDATE_CHANGE_TYPES

const fail = (message: string): never => {
  throw new PlanChangeError(message)
}

/** The JSON values found in a text: the whole of it, or what its code blocks and outermost braces hold. */
function jsonIn(text: string): unknown[] {
  const candidates = [
    text,
    ...[...text.matchAll(/```(?:json|jsonc)?\s*\n([\s\S]*?)```/g)].map((block) => block[1]).toReversed(),
    text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1),
  ]
  return candidates.flatMap((candidate) => {
    try {
      return [JSON.parse(candidate) as unknown]
    } catch {
      return []
    }
  })
}

const changesOf = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) return value
  if (isRecord(value) && Array.isArray(value.changes)) return value.changes
  // One change on its own is an update of one change.
  if (isRecord(value) && typeof value.type === 'string') return [value]
  return null
}

/**
 * Reads an update from untrusted input: the document itself, or the text of an answer that holds it, usually in
 * a code block. Throws `PlanChangeError` that names the change at fault, so the message can go back to the chat.
 */
export function parseUpdate(input: unknown): PlanUpdate {
  const values = typeof input === 'string' ? jsonIn(input) : [input]
  if (!values.length) return fail('No JSON found: the update is a JSON object with a "changes" list')
  const value = values.find((candidate) => changesOf(candidate)) ?? values[0]
  const raw = changesOf(value) ?? fail('The update needs a "changes" list')
  if (!raw.length) return fail('The update has no changes')
  if (raw.length > CHANGES_MAX) return fail(`The update has more than ${CHANGES_MAX} changes`)
  const changes = raw.map((item, index) => {
    const type = isRecord(item) && typeof item.type === 'string' ? item.type : ''
    const where = `Change ${index + 1}${type ? ` (${type})` : ''}`
    if (type && !ALLOWED.includes(type)) return fail(`${where}: an update cannot carry this type of change`)
    try {
      return parseChange(item)
    } catch (err) {
      return fail(`${where}: ${err instanceof Error ? err.message : String(err)}`)
    }
  })
  const summary = isRecord(value) && typeof value.summary === 'string' ? value.summary.trim() : ''
  return { format: UPDATE_FORMAT, summary, changes }
}

/** What an update would do to a plan, worked out without storing anything. */
export interface UpdatePreview {
  /** The plan after the changes that fit */
  after: Plan
  /** Events added, removed and changed, compared with the plan as it is */
  diff: PlanDiff
  /** Calendars the update creates */
  calendars: PlanCalendar[]
  /** The first change that does not fit the plan; `index` counts from 0. null when all fit */
  problem: { index: number; message: string } | null
  /** Mondays (`YYYY-MM-DD`) of the weeks the update fills past the weekly budget, with their hours */
  overBudget: Array<{ week: string; hours: number }>
}

const brief = ({ uid, calendar, title, start, end }: PlanEvent) => ({ uid, calendar, title, start, end })

/** A preview as plain data for a tool: what would change, in few enough words to read back to a person. */
export function reportPreview(preview: UpdatePreview) {
  return {
    ok: preview.problem === null,
    problem: preview.problem && {
      change: preview.problem.index + 1,
      message: preview.problem.message,
    },
    calendarsAdded: preview.calendars.map(({ id, name }) => ({ id, name })),
    added: preview.diff.added.map(brief),
    removed: preview.diff.removed.map(brief),
    changed: preview.diff.changed.map(({ before, after }) => ({ before: brief(before), after: brief(after) })),
    weeksOverBudget: preview.overBudget,
  }
}

/**
 * Applies the changes of an update to `plan` in memory. An update is all or nothing: with a `problem` it must not
 * be stored, and `after` then shows the plan up to the change at fault.
 */
export function previewUpdate(plan: Plan, changes: PlanChange[], now = Date.now()): UpdatePreview {
  let edits = emptyEdits()
  let problem: UpdatePreview['problem'] = null
  for (const [index, change] of changes.entries()) {
    try {
      edits = applyChange(plan, edits, change, now)
    } catch (err) {
      problem = { index, message: err instanceof Error ? err.message : String(err) }
      break
    }
  }
  return updateOutcome(plan, applyEdits(plan, edits).plan, problem)
}

/** What changed between the plan before an update and the plan after it, in the shape of a preview. */
export function updateOutcome(plan: Plan, after: Plan, problem: UpdatePreview['problem'] = null): UpdatePreview {
  const known = new Set(plan.calendars.map((c) => c.id))
  const before = weeklyHours(plan)
  const budget = plan.meta.weeklyBudgetHours
  return {
    after,
    diff: diffPlans(plan, after),
    calendars: after.calendars.filter((c) => !known.has(c.id)),
    problem,
    overBudget: Object.entries(weeklyHours(after))
      .filter(([week, hours]) => hours > budget && hours > (before[week] ?? 0))
      .map(([week, hours]) => ({ week, hours }))
      .toSorted((a, b) => a.week.localeCompare(b.week)),
  }
}
