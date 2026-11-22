// Regenerates the plan database from packages/plan-domain/src/content.ts, the schedule rules and data/edits.json.
//   pnpm run plan            → writes data/plan.json
//   pnpm run plan --ics   → also writes exports/*.ics
import { mkdirSync, writeFileSync } from 'node:fs'

import { IMPORT_HOWTO, calendarICS, icsFileName, weeklyHours } from '@lc/plan-domain'

import { readEdits, writePlan } from '../src/store'

const edits = readEdits()
const { plan, orphans } = writePlan(edits)
console.log(
  `data/plan.json: ${plan.events.length} events, ${Object.keys(edits.events).length} manual edits, certificates done ${plan.meta.lastCertDay}, plan ends ${plan.meta.planEnd}`,
)
if (orphans.length)
  console.warn('Edits for events that no longer exist (remove them from data/edits.json):', orphans.join(', '))

const over = Object.entries(weeklyHours(plan)).filter(([, h]) => h > plan.meta.weeklyBudgetHours)
if (over.length) console.warn('Weeks over budget:', over.map(([w, h]) => `${w}: ${h} h`).join(', '))

if (process.argv.includes('--ics')) {
  mkdirSync('exports', { recursive: true })
  for (const c of plan.calendars) {
    if (plan.events.some((e) => e.calendar === c.id)) writeFileSync(`exports/${icsFileName(c)}`, calendarICS(plan, c))
  }
  writeFileSync('exports/Как импортировать.txt', IMPORT_HOWTO(plan.calendars.filter((c) => c.isNew).map((c) => c.name)))
  console.log('exports/: .ics files written')
}
