# @lc/plan-data

The adapters of the plan's ports, for a host that runs on Node: the files of a checkout, the person's iCal feed, the HiGHS
solver, Google and Outlook. Each is an entry, so a host takes the ones it needs. Node only.

- `./fs`: `createFsPorts`, the plans, library, settings and sync state as files in the data directory; `findDataDir`;
  `bundledPlan`. The only code that writes the data files, atomically.
- `./ical`: reads the busy calendar from an iCal address.
- `./highs`: `solveLp`, the LP solver behind a re-balance (loaded on first use).
- `./google`, `./outlook`: the calendar apps' connectors (OAuth, API calls) and a fake of each app for tests.
- `./local`: `localPorts`, every adapter above wired into one `PlanPorts` for a checkout. The app and the MCP server call it.
- `scripts/build-plan.ts`: `pnpm run plan`, regenerates `plan.json` from `@lc/plan-content` and `edits.json`.

May import: `@lc/plan-service` (the ports it implements), `@lc/plan-domain`, `@lc/plan-content`. Never React or a module.

Tested with Vitest beside the code; the port contracts from `@lc/plan-service/testing` run against the file adapter:
`pnpm exec nx run @lc/plan-data:test`.

Owns `data/`: `plan.json` (generated, never hand-edited) and `edits.json` (the owner's manual edits) are tracked;
`history.json`, `sync.json`, `sync.lock` (held while a calendar round runs, in any process), `local.json` (secrets)
and `library/` are untracked.
