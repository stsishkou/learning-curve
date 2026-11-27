import type { Plan, PlanCalendar } from './types'

/** The longest label: a few words, not a sentence */
export const LABEL_MAX = 40

/** The most labels one calendar carries */
export const LABELS_MAX = 8

/** A label as it is kept: spaces trimmed and collapsed; '' when nothing is left. */
export const cleanLabel = (text: string): string => text.trim().replaceAll(/\s+/g, ' ').slice(0, LABEL_MAX).trim()

/** Labels compare without case: "partners" and "Partners" are one label. */
export const sameLabel = (a: string, b: string): boolean => a.toLocaleLowerCase() === b.toLocaleLowerCase()

/** Labels from untrusted input, each once (its first spelling wins); anything that is not text is dropped. */
export function labelList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const kept: string[] = []
  for (const raw of value) {
    if (typeof raw !== 'string') continue
    const label = cleanLabel(raw)
    if (label && !kept.some((other) => sameLabel(other, label))) kept.push(label)
    if (kept.length === LABELS_MAX) break
  }
  return kept
}

export const hasLabel = (calendar: Pick<PlanCalendar, 'labels'>, label: string): boolean =>
  (calendar.labels ?? []).some((own) => sameLabel(own, label))

export interface PlanLabel {
  /** The spelling of the first calendar that carries it */
  name: string
  /** Ids of the calendars that carry it, in the order the plan lists them */
  calendars: string[]
}

/** Every label of the plan, in the order of the first calendar that carries it. */
export function planLabels(plan: Pick<Plan, 'calendars'>): PlanLabel[] {
  const labels: PlanLabel[] = []
  for (const calendar of plan.calendars) {
    for (const name of calendar.labels ?? []) {
      const known = labels.find((label) => sameLabel(label.name, name))
      if (known) known.calendars.push(calendar.id)
      else labels.push({ name, calendars: [calendar.id] })
    }
  }
  return labels
}

export interface LabelGroup<T> {
  /** null for the group of what carries no label */
  label: string | null
  items: T[]
}

/**
 * Items grouped by the labels of their calendars: one group per label in the order of `planLabels`, then the items
 * without a label. An item whose calendar carries two labels is in both groups. With no label at all, one group of
 * everything.
 */
export function groupByLabel<T>(
  items: readonly T[],
  calendarOf: (item: T) => Pick<PlanCalendar, 'labels'>,
): LabelGroup<T>[] {
  const groups: LabelGroup<T>[] = []
  const unlabelled: T[] = []
  for (const item of items) {
    const labels = calendarOf(item).labels ?? []
    if (!labels.length) unlabelled.push(item)
    for (const name of labels) {
      const known = groups.find((group) => group.label !== null && sameLabel(group.label, name))
      if (known) known.items.push(item)
      else groups.push({ label: name, items: [item] })
    }
  }
  return unlabelled.length || !groups.length ? [...groups, { label: null, items: unlabelled }] : groups
}

/** True when some item counts in more than one group: totals by label then add up to more than the whole. */
export function countsTwice<T>(groups: readonly LabelGroup<T>[]): boolean {
  const seen = new Set<T>()
  for (const { items } of groups) {
    for (const item of items) {
      if (seen.has(item)) return true
      seen.add(item)
    }
  }
  return false
}
