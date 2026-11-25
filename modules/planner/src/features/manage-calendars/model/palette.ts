import type { Plan } from '@lc/plan-domain'

const PALETTE: readonly [string, ...string[]] = [
  '#0f8fc4',
  '#5b8c2a',
  '#d8473b',
  '#b0562b',
  '#3f51b5',
  '#00897b',
  '#9c27b0',
  '#6b7280',
]

/** Offered for a new calendar: the first color no calendar uses yet. */
export function freeColor(plan: Plan): string {
  const used = new Set(plan.calendars.map((c) => c.color.toLowerCase()))
  return PALETTE.find((color) => !used.has(color)) ?? PALETTE[0]
}
