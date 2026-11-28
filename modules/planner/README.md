# @lc/planner

The study planner as a microfrontend, composed at build time: the planner page (week grid, agenda, budget, runway, event
editing, re-balance), the timeline page and the focus page. Feature-Sliced layers inside (`pages`, `widgets`, `features`,
`shared`); `src/index.ts` is the only entry.

- `PlannerPage` takes grouped props: `plan` (the view and how to change it: every edit, undo and redo comes through
  it), `url` (search state and its setter), `abilities` (what the host can do besides, each optional: `library` of plan
  files, `busy` time from the person's calendar, calendar-app `sync`, `rebalance` and the `focus` page) and `slots` (the
  host's own UI: actions beside the plan's name, the export dialog, commands). Also `FocusPage`, `TimelinePage` and
  their `parse*Search` helpers.
- Everything the module needs from outside comes in as props and callbacks; it has no idea where the data is stored.

May import: `@lc/plan-domain` (and its entries), `@lc/ui`, `@lc/i18n`. Never another module, `@lc/plan-data`,
`@lc/plan-service`, `@lc/plan-content`, `node:*`, or server functions (Oxlint, `.oxlintrc.json`). Steiger checks the layers
(`pnpm exec nx run @lc/planner:lint:fsd`).

Tested with Vitest beside the code: `pnpm exec nx run @lc/planner:test`; its stories are in the stand.

Owns no data files.
