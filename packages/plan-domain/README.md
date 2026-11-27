# @lc/plan-domain

The plan's rules as pure TypeScript: types, Minsk wall-clock dates, the schedule's rules and warnings, edits and the one
reducer that applies them, history, insights, the update protocol, `.ics`, calendar-sync rules, and the re-balance
model. No React, no Node, no other workspace package. Everything above it in the layer rule may import it.

Entries (each a folder of `src/`, imported by name; areas depend one way, enforced by Oxlint):

- `.` (`core`): types, `dates`, `PlanChange` and `applyChange`, `edits`, `history`, ids (`PlanId`, `UserId`), rules,
  trash, occurrences, progress. Imports nothing.
- `./insights`: stats, streak, forecast, lanes, reviews, re-plan scenarios, accuracy report. Imports `core`.
- `./protocol`: the update JSON Schema, `parseChange` and the guide a model reads, which describe one protocol and drift
  together. Imports `core`, `insights`.
- `./ics`: `.ics` text for a calendar and the import how-to. Imports `core`.
- `./sync`: what is written to a calendar app, what an edit there means, each app's event format. Imports `core`,
  `protocol`, `ics`.
- `./rebalance`: the room, the integer program in a neutral `LpModel`, placement, the report. The solver is a function
  passed in. Imports `core`.
- `./fixtures`: a frozen copy of the generated plan with fixed dates, for tests and stories. Imports anything in the
  package.

Tested with Vitest beside the code: `pnpm exec nx run @lc/plan-domain:test`. The protocol tests fail when the schema, the
guide and `parseChange` drift apart.

Owns no data files; `src/fixtures/base-plan.json` is a frozen test fixture, not the plan.
