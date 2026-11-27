// Regenerates the plan database from packages/plan-content/src/content.ts, the schedule rules and data/edits.json.
//   pnpm run plan            → writes data/plan.json
//   pnpm run plan --ics   → also writes exports/*.ics
import { mkdirSync, writeFileSync } from 'node:fs'

import { nextDeadline, parseLocal, weeklyHours } from '@lc/plan-domain'
import { IMPORT_HOWTO, calendarICS, icsFileName } from '@lc/plan-domain/ics'
import { DEFAULT_PLAN, LOCAL_ACTOR, createPlanServices, failureMessage } from '@lc/plan-service'

import { findDataDir } from '../src/fs'
import { localPorts } from '../src/local'

const ports = localPorts({ dir: findDataDir(process.cwd(), process.env), env: process.env })
const { plans } = createPlanServices(ports)

// The count of edits as stored, before the rebuild purges what has outstayed the trash.
const stored = await ports.plans.get(DEFAULT_PLAN)
const manualEdits = Object.keys(stored?.edits.events ?? {}).length
const rebuilt = await plans.rebuild(LOCAL_ACTOR)

if (rebuilt.ok) {
  const { plan } = rebuilt.value.view
  const { orphans } = rebuilt.value
  const deadline = nextDeadline(plan, parseLocal(`${plan.meta.generated}T00:00`))
  console.log(
    `data/plan.json: ${plan.events.length} events, ${manualEdits} manual edits, plan ends ${plan.meta.planEnd}${deadline ? `, next deadline ${deadline.day} (${deadline.calendar})` : ''}`,
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
    writeFileSync(
      'exports/Как импортировать.txt',
      IMPORT_HOWTO(plan.calendars.filter((c) => c.isNew).map((c) => c.name)),
    )
    console.log('exports/: .ics files written')
  }
} else {
  console.error(failureMessage(rebuilt.error))
  process.exitCode = 1
}
