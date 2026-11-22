// Regenerates the plan database from src/lib/plan/content.ts and the schedule rules.
//   pnpm run plan            → writes src/data/plan.json
//   pnpm run plan --ics   → also writes exports/*.ics
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildICS, icsFileName, IMPORT_HOWTO } from '../src/lib/plan/ics'
import { buildPlan, weeklyHours } from '../src/lib/plan/schedule'

const plan = buildPlan()
writeFileSync('src/data/plan.json', JSON.stringify(plan, null, 2) + '\n')
console.log(`src/data/plan.json: ${plan.events.length} events, certificates done ${plan.meta.lastCertDay}, plan ends ${plan.meta.planEnd}`)

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
