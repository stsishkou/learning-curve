import { isCalendarProvider, type CalendarProvider } from './calendar-sync'
import { parseChange, type PlanChange } from './changes'
import { emptyEdits, isRecord, parseEdits, type PlanEdits } from './edits'
import type { Plan } from './types'

/** Older steps are dropped: the state before them becomes the new starting point. */
export const HISTORY_LIMIT = 100

/** Where a change was made, when not in the planner or by a tool: the calendar app it was made in. */
export type StepSource = CalendarProvider

/** One change in the history, as the viewer shows it. */
export interface HistoryStep {
  /** When it was made, an ISO instant */
  at: string
  change: PlanChange
  /** Title of the event or name of the calendar it touched, as it was then; empty when it touched neither */
  subject: string
  source?: StepSource | undefined
}

interface StoredStep extends HistoryStep {
  /** The edits right after this step */
  edits: PlanEdits
}

/** Every change with the edits it led to, so the plan can be moved back and forward. */
export interface PlanHistory {
  version: 1
  /** The edits before the first step */
  origin: PlanEdits
  steps: StoredStep[]
  /** How many steps are applied now; the steps after it were undone and can be redone */
  cursor: number
}

export interface HistoryView {
  steps: HistoryStep[]
  cursor: number
}

export const emptyHistory = (origin: PlanEdits = emptyEdits()): PlanHistory => ({
  version: 1,
  origin,
  steps: [],
  cursor: 0,
})

/** What a change is about, read from the plan as it was before the change. */
function subjectOf(plan: Plan, change: PlanChange): string {
  switch (change.type) {
    case 'event.add':
      return change.event.title
    case 'event.patch':
    case 'event.detach':
    case 'event.split':
    case 'event.remove':
      return plan.events.find((e) => e.uid === change.uid)?.title ?? ''
    case 'calendar.save':
    case 'course.add':
      return change.name
    case 'events.add': {
      const [only, ...others] = change.events
      return only && !others.length ? only.title : ''
    }
    case 'plan.rename':
      return change.title
    case 'plan.countdown':
      return change.calendar === null ? '' : (plan.calendars.find((c) => c.id === change.calendar)?.name ?? '')
    case 'reviews.plan':
      return change.reviews[0]?.title.replace(/ \(\d+\/\d+\)$/, '') ?? ''
    case 'calendar.remove':
    case 'calendar.clear':
      return plan.calendars.find((c) => c.id === change.id)?.name ?? ''
    case 'events.shift':
    case 'events.move':
      return change.calendar ? (plan.calendars.find((c) => c.id === change.calendar)?.name ?? '') : ''
    case 'events.done': {
      const [only, ...others] = change.uids
      return only && !others.length ? (plan.events.find((e) => e.uid === only)?.title ?? '') : ''
    }
    case 'trash.restore':
    case 'trash.empty':
      return ''
    default:
      // A new kind of change has to say what it is about, even when that is nothing.
      return change satisfies never
  }
}

/** The history after one more change. Steps that were undone are dropped: the new change takes their place. */
export function recordChange(
  history: PlanHistory,
  before: Plan,
  change: PlanChange,
  after: PlanEdits,
  source?: StepSource,
  now = Date.now(),
): PlanHistory {
  const step: StoredStep = {
    at: new Date(now).toISOString(),
    change,
    subject: subjectOf(before, change),
    ...(source ? { source } : {}),
    edits: after,
  }
  const steps = [...history.steps.slice(0, history.cursor), step]
  const dropped = Math.max(0, steps.length - HISTORY_LIMIT)
  return {
    version: 1,
    origin: steps.slice(0, dropped).at(-1)?.edits ?? history.origin,
    steps: steps.slice(dropped),
    cursor: steps.length - dropped,
  }
}

/** The edits at a point of the history: 0 is the start, `steps.length` the latest. */
export const historyEdits = (history: PlanHistory, cursor = history.cursor): PlanEdits =>
  (cursor > 0 ? history.steps[cursor - 1]?.edits : undefined) ?? history.origin

export const travel = (history: PlanHistory, cursor: number): PlanHistory => ({
  ...history,
  cursor: Math.max(0, Math.min(history.steps.length, Math.round(cursor))),
})

/** False when the edits were changed past the history, by hand or by another tool: it no longer describes them. */
export const inSync = (history: PlanHistory, edits: PlanEdits) =>
  JSON.stringify(historyEdits(history)) === JSON.stringify(edits)

export const historyView = (history: PlanHistory): HistoryView => ({
  cursor: history.cursor,
  steps: history.steps.map(({ at, change, subject, source }) => ({
    at,
    change,
    subject,
    ...(source ? { source } : {}),
  })),
})

/** Reads a history from untrusted input; anything malformed gives an empty one. */
export function parseHistory(value: unknown): PlanHistory {
  if (!isRecord(value) || !Array.isArray(value.steps)) return emptyHistory()
  try {
    const steps = value.steps.map((raw: unknown): StoredStep => {
      if (!isRecord(raw) || typeof raw.at !== 'string') throw new Error('malformed step')
      return {
        at: raw.at,
        change: parseChange(raw.change),
        subject: typeof raw.subject === 'string' ? raw.subject : '',
        ...(isCalendarProvider(raw.source) ? { source: raw.source } : {}),
        edits: parseEdits(raw.edits),
      }
    })
    const history: PlanHistory = { version: 1, origin: parseEdits(value.origin), steps, cursor: 0 }
    return travel(history, typeof value.cursor === 'number' ? value.cursor : steps.length)
  } catch {
    return emptyHistory()
  }
}
