# @lc/plan-service

The application layer of the plan. It owns the ports: the interfaces every store and outside service implements
(plans, the library, sync state, private settings, the busy calendar, the LP solver, calendar apps, the clock, the
host's rules), each documented with what every implementation guarantees. Beside them: who may do what with a plan
(`accessOf`, `mustOwn`), failures as values (`Result`, `PlanFailure`), the actor a call is made for, and the
newest-only queue. Use cases are written against the ports, so a store or a service can be swapped without touching
them. The adapters live in `@lc/plan-data`; each composition root wires them.

- `.` (`src/index.ts`): the only entry. `src/ports/` holds one file per port; `src/ports/index.ts` adds `PlanPorts`,
  the set of them a composition root passes in.

Imports `@lc/plan-domain` and its entries only: never React, `node:*`, `@lc/plan-data` or `@lc/plan-content`
(an Oxlint override in `.oxlintrc.json`).

Tested with Vitest beside the code: `pnpm exec nx run @lc/plan-service:test`.

Owns no data files.
