import { DAY, feedAddress, isPlan, parseChange, type Plan, type PlanChange } from '@lc/plan-domain'
import { parseRebalanceRequest, type RebalanceRequest } from '@lc/plan-domain/rebalance'

import type { PlanFileSave } from './services/library'

/** The longest stretch of busy time read at once: a month grid is six weeks */
const MAX_WINDOW = 62 * DAY

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) throw new Error('An object is required')
  return { ...value }
}

const text = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`)
  return value.trim()
}

const optional = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

/** The changes of an update to store: a list of at least one, each read by `parseChange`. */
export function parseChanges(input: unknown): PlanChange[] {
  if (!Array.isArray(input) || !input.length) throw new Error('Changes are required')
  return input.map(parseChange)
}

/** A step of the history to move to: a whole number from 0. */
export function parseCursor(input: unknown): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < 0) throw new Error('A step is required')
  return input
}

/** The stretch of busy time to read, between two Minsk wall-clock moments at most 62 days apart. */
export function parseBusyWindow(input: unknown): { from: number; to: number } {
  if (typeof input !== 'object' || input === null || !('from' in input) || !('to' in input)) {
    throw new Error('A window is required')
  }
  const { from, to } = input
  if (typeof from !== 'number' || typeof to !== 'number' || !(to > from) || to - from > MAX_WINDOW) {
    throw new Error('A window of at most two months is required')
  }
  return { from, to }
}

/** A busy-calendar address as it is fetched (`webcal:` read as https), or null to forget the one set. */
export function parseBusyAddress(input: unknown): string | null {
  if (input === null) return null
  const valid = typeof input === 'string' ? feedAddress(input) : null
  if (!valid) throw new Error('An https or webcal address of an iCal file is required')
  return valid
}

/** A file of the library and, optionally, one of its versions. */
export function parseFileRef(input: unknown): { id: string; version: string | undefined } {
  const { id, version } = record(input)
  return { id: text(id, 'id'), version: optional(version) }
}

/** A plan to keep in the library, with its name and, optionally, the file it adds a version to and a note. */
export function parseFileSave(input: unknown): PlanFileSave {
  const { id, name, plan, note } = record(input)
  if (!isPlan(plan)) throw new Error('A plan is required')
  return { id: optional(id), name: text(name, 'name'), plan, note: optional(note) }
}

/** A file of the library and its new name. */
export function parseFileRename(input: unknown): { id: string; name: string } {
  const { id, name } = record(input)
  return { id: text(id, 'id'), name: text(name, 'name') }
}

/** The plan in view and a re-balance request for one of its calendars, checked against that plan. */
export function parseRebalanceInput(input: unknown): { plan: Plan; request: RebalanceRequest } {
  if (typeof input !== 'object' || input === null || !('plan' in input) || !isPlan(input.plan)) {
    throw new Error('A plan is required')
  }
  const request = 'request' in input ? input.request : undefined
  return { plan: input.plan, request: parseRebalanceRequest(request, input.plan) }
}
