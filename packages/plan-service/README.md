# @lc/plan-service

The application layer of the plan. It owns the ports: the interfaces every store and outside service implements
(plans, the library, sync state, private settings, the busy calendar, the LP solver, calendar apps, the clock, the
host's rules), each documented with what every implementation guarantees. Beside them: who may do what with a plan
(`accessOf`, `mustOwn`), failures as values (`Result`, `PlanFailure`), the actor a call is made for, and the
newest-only queue. Use cases are written against the ports, so a store or a service can be swapped without touching
them. The adapters live in `@lc/plan-data`; each composition root wires them.

- `.` (`src/index.ts`): the entry of the application layer. `src/ports/` holds one file per port; `src/ports/index.ts` adds `PlanPorts`,
  the set of them a composition root passes in. `src/services/` holds the use cases, built by
  `createPlanServices(ports)`: the plan, the library, busy time, re-balance and the calendar sync; each resolves the
  actor's plan and asks `accessOf` itself. `src/services/calendar-sync/` holds the sync rounds and the inbox
  decisions, run one at a time; a stored change starts a round for every connected calendar app. `src/parse.ts` reads each use case's input from untrusted JSON, with the messages a
  person sees.

- `./testing` (`src/testing/index.ts`): for the tests of an adapter and of a host. `describe*` functions run the contract
  of each port against any implementation, and `createMemoryPorts` is a complete in-memory `PlanPorts`. It depends on
  Vitest, so no production code imports it.

Imports `@lc/plan-domain` and its entries only: never React, `node:*`, `@lc/plan-data` or `@lc/plan-content`
(an Oxlint override in `.oxlintrc.json`).

Tested with Vitest beside the code: `pnpm exec nx run @lc/plan-service:test`.

Owns no data files.
