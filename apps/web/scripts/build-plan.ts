// Regenerates the plan database from src/lib/plan/content.ts, the schedule rules and src/data/edits.json.
//   pnpm run plan            → writes src/data/plan.json
//   pnpm run plan --ics   → also writes exports/*.ics
import { mkdirSync, writeFileSync } from 'node:fs'

import { buildICS, icsFileName, IMPORT_HOWTO } from '../src/lib/plan/ics'
import { weeklyHours } from '../src/lib/plan/schedule'
import { readEdits, writePlan } from '../src/lib/plan/store'

const edits = readEdits()
const { plan, orphans } = writePlan(edits)
console.log(
  `src/data/plan.json: ${plan.events.length} events, ${Object.keys(edits.events).length} manual edits, certificates done ${plan.meta.lastCertDay}, plan ends ${plan.meta.planEnd}`,
)
if (orphans.length)
  console.warn('Edits for events that no longer exist (remove them from src/data/edits.json):', orphans.join(', '))

const over = Object.entries(weeklyHours(plan)).filter(([, h]) => h > plan.meta.weeklyBudgetHours)
if (over.length) console.warn('Weeks over budget:', over.map(([w, h]) => `${w}: ${h} h`).join(', '))

if (process.argv.includes('--ics')) {
  mkdirSync('exports', { recursive: true })
  for (const c of plan.calendars) {
    const events = plan.events.filter((e) => e.calendar === c.id)
    if (events.length) writeFileSync(`exports/${icsFileName(c)}`, buildICS(c, events, plan.meta.timezone))
  }
  writeFileSync('exports/Как импортировать.txt', IMPORT_HOWTO(plan.calendars.filter((c) => c.isNew).map((c) => c.name)))
  console.log('exports/: .ics files written')
}
