# @lc/web

The deployable web app, and the composition root of the planner: a thin TanStack Start shell (React 19, Vite, Nitro) that
loads the plan, hands it to the modules as props and callbacks, and answers `/api/*`. It holds no plan rules; those are
in `@lc/plan-domain` and `@lc/plan-service`.

- `src/routes/`: file routes. `index`, `timeline`, `focus` render the planner module's pages, `dashboard` the dashboard
  module's; `api/` holds `/api/plan*`, the `.ics` downloads and the calendar sign-in routes. `routeTree.gen.ts` is
  generated.
- `src/server/`: server functions and the wiring. `services.ts` builds the use cases once over `@lc/plan-data/local`;
  `actor.ts` says who is calling (the local owner today); `respond.ts` turns a failure into its HTTP status; the other
  files are one adapter per area (`plan`, `library`, `busy`, `calendars`, `reschedule`, `docs`).
- `src/shell/`: the bar every page shares, the theme and language switchers, the docs button.

May import: every project below it (modules, `@lc/plan-data/*`, `@lc/plan-service`, `@lc/plan-domain`, `@lc/i18n`,
`@lc/ui`, `@lc/remote-host`, `@lc/docs-contract`). Nothing imports the app.

Run `pnpm run dev` (port 3000), `pnpm exec nx run @lc/web:build` and `pnpm run start`. Checked by
`pnpm exec nx run @lc/web:typecheck`; it has no tests of its own, its adapters are covered by the service and adapter tests
and by the stand. `PLAN_DATA_DIR` moves the data directory, `PLAN_READONLY=1` switches writing off.

Owns no data files: `@lc/plan-data/fs` reads and writes `packages/plan-data/data`.
