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

## Container

`Dockerfile` builds the planner from the repository root (the build context) into an image that holds only Nitro's
output and runs it as an unprivileged user on port 3000. `compose.yaml` and `planner.env.example` at the root run it:

```bash
cp planner.env.example planner.env              # optional: OAuth clients, read-only mode, docs button
docker compose up -d --build                    # http://localhost:3000
docker compose --profile seed run --rm seed     # once: copy the plan from this checkout into the volume
```

- **Data**: everything the planner writes lives on the volume at `/data` (`PLAN_DATA_DIR`). An empty volume serves the
  plan bundled at build time, read-only; the seed copies `plan.json`, `edits.json`, `history.json`, `sync.json` and
  `library/`, never `local.json`. Back the volume up: it holds the plan, the history and the calendar tokens.
- **One server**: the files and the calendar-sync lock assume one container per volume, so run no replicas.
- **Calendar apps**: register `https://<your-domain>/api/google/callback` and `/api/outlook/callback` on the OAuth
  clients set in `planner.env`, then connect the apps again in the deployed planner.
- **No sign-in yet**: anyone who reaches the server can edit the plan. Put an authenticating proxy in front of it, or
  set `PLAN_READONLY=1` for a public, view-only planner.
- **Other CPUs**: the image is built for the machine that builds it; add `--platform linux/amd64` for an x86 server.
