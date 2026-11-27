# Architecture

One trunk-based repository, managed by [Nx](https://nx.dev) on top of pnpm workspaces. Everything deployable
lives in `apps/`, every vertical slice of the product is a module in `modules/`, and code shared between them
is a package in `packages/`.

```
apps/
  web/                 TanStack Start shell: routes, server functions, HTML document. Composes the modules.
modules/               microfrontends, composed at build time
  planner/             the planner page (week grid, agenda, budget, runway, event editing), the timeline and focus pages
  calendar-export/     the export dialog (.ics, zip, combined calendar)
  dashboard/           the progress page at /dashboard: stat tiles and charts, read-only
packages/
  plan-domain/         the domain: types, Minsk dates, schedule rules, edits, .ics, the re-balance model. Pure TypeScript
  plan-data/           the database on disk (data/plan.json, data/edits.json), `pnpm run plan`, the HiGHS solver. Node only
  i18n/                messages (ru, en, es), the compiled Paraglide output, locale-aware formatting
  ui/                  UI kit and the Tailwind theme tokens
```

A backend comes in as another directory under `apps/` (`apps/api` with FastAPI or NestJS, each with its own
`Dockerfile`). Nx runs any project that has a `package.json` or a `project.json` with commands, so a Python
service takes part in `nx affected` like the TypeScript ones. Contracts shared with a backend go to `packages/`.

## Dependency rules

```
apps/web ──▶ modules/* ──▶ packages/plan-domain
   │             └───────▶ packages/ui, packages/i18n
   └──▶ packages/plan-data ──▶ packages/plan-domain
```

| Package type | Tag | May import | Never |
|---|---|---|---|
| app | `type:app` | modules, data, domain, shared | — |
| module | `type:module` | domain, shared | another module, the app, `plan-data`, `node:*`, server functions |
| data | `type:data` | domain | React, anything else in the workspace |
| domain | `type:domain` | nothing | React, Node, any workspace package |
| shared | `type:shared` | nothing in the workspace | the plan, modules, the app |

Three things enforce this:

1. **pnpm**: a package can only import what its `package.json` lists.
2. **Oxlint** (`overrides` in `.oxlintrc.json`): says which dependencies are allowed per package type, and
   forbids deep imports (`@lc/x/src/...`) and reaching into another package by relative path.
3. **Steiger** (`steiger.config.ts`): checks the Feature-Sliced layers inside each module.

The Nx `enforce-module-boundaries` plugin is not used: it loads typescript-eslint, which does not run on
TypeScript 7. The tags are still set (`nx` field in each `package.json`), so `nx run-many --projects=tag:type:module`
and the project graph work, and the plugin can replace the Oxlint overrides once it supports TypeScript 7.

## Modules are microfrontends composed at build time

A module is a workspace package with one public entry (`src/index.ts`). The app imports it like a library and
Vite builds everything into one deployable, so routes stay typed and server rendering works.

Modules do not know about each other, about the router, or about where data comes from. The app passes that in:

```tsx
// apps/web/src/routes/index.tsx
<PlannerPage
  state={Route.useLoaderData()}                 // data: loaded by a server function the app owns
  search={Route.useSearch()}                    // URL state: the app owns the router
  onSearchChange={…}
  onChange={…}                                  // persistence: one server function for every PlanChange
  rebalance={rebalance}                         // heavy work the server does: re-balancing a calendar
  renderExport={(dialog) => <ExportDialog {...dialog} />}   // another module, opened from the planner's integrations
  commands={shellCommands()}                    // palette entries the app owns: theme, language
/>
```

Every edit is one `PlanChange` value from `@lc/plan-domain` (`event.patch`, `event.add`, `calendar.save`, …).
The same pure reducer, `applyChange`, runs in three places: on the server before the edits file is written, in
the browser to show a change before the server answers, and on a plan file opened from disk, whose edits never
leave the browser. A new kind of edit is a new member of that union, not a new server function.

That keeps each module testable on its own and makes it possible to serve one as a runtime remote later
(`@module-federation/tanstack`) without restructuring: its public entry is already the federation boundary.

## Inside a module: Feature-Sliced Design

Each module's `src/` follows [Feature-Sliced Design](https://feature-sliced.design) 2.1.

```
src/
  index.ts             the module's public API
  pages/               a full screen, composed from the layers below
  widgets/             self-contained blocks of a page (week grid, month grid, plan map, course progress, timeline)
  features/            one user action each (edit an event, manage calendars, open a plan file, command palette)
  entities/            business objects with their UI (none yet: the domain lives in @lc/plan-domain)
  shared/              helpers with no business meaning
```

- A layer imports only from layers below it. Slices on the same layer do not import each other.
- Every slice has an `index.ts`; nothing outside the slice imports past it.
- Inside a slice, code is split by purpose: `ui/`, `model/` (state, hooks), `lib/`, `api/`.
- Imports inside a module are relative; imports of another package go by its name.

## How the principles map

- **Single responsibility**: one reason to change per package — rules of the plan (`plan-domain`), where it is
  stored (`plan-data`), how it looks (`ui`), what it says (`i18n`), one user-facing area (each module).
- **Open/closed**: the planner is extended through `renderActions`, `renderExport` and `commands`, not edited, when
  the app adds an action.
- **Liskov / interface segregation**: components take the narrow data they use (`plan`, `hidden`), not a store or
  a router.
- **Dependency inversion**: modules declare callbacks (`onChange`, `onSearchChange`, `rebalance`); the app supplies
  the implementation. The domain depends on nothing: even the solver is passed in.

## Adding things

- **A feature in a module**: new slice under `features/` or `widgets/` with an `index.ts`, used from the page.
- **A module**: copy the shape of `modules/calendar-export` (`package.json` with the `type:module` tag,
  `tsconfig.json`, `src/index.ts`), add it to `apps/web/package.json` and compose it in a route. The lint rule for
  `modules/**` already refuses every `@lc/*` package except the shared ones, so nothing is added there.
- **A page**: it draws no header. The app's root route renders one bar for every route (`ShellBar`, built on
  `AppBar` from `@lc/ui`): the sections, Expand and Full screen, and a settings panel with the language, the theme,
  the display switches and the links about the app. Moving between pages never moves it. A page names itself with
  an `sr-only` `h1`; a control only it needs goes in its own content, its `⋮` menu or a `Hint`, never in the bar. A
  page laid out wide (expanded or in full screen) hides the bar and shows Collapse in its own top row.
- **A route**: a file in `apps/web/src/routes` that renders a module's page. Keep logic out of route files.
- **A server function**: `apps/web/src/server/`, using `@lc/plan-data`; pass the result into the module as props.
- **Something read from outside the plan** (the person's own calendar): fetched and parsed in `plan-data`
  (`busy.ts`), offered by a server function, and passed to the module as a prop with a `load` callback. It never
  becomes a `PlanChange`; a local setting such as its address lives in the untracked `data/local.json`, written by
  `store.ts`.
- **State kept for the calendars that read the plan** (the version of each event in the feeds): untracked
  `data/sync.json`, written only by `store.ts`; the rules that compute it are pure, in `plan-domain` (`revisions.ts`).
- **A calendar app the plan is written to** (Google Calendar, Outlook): what is written, what an edit there means and
  which edits wait for a decision (`triage`) are pure and app-neutral, in `plan-domain` (`calendar-sync.ts`); each
  app's event format is pure too (`google-sync.ts`, `outlook-sync.ts`). In `plan-data/src/calendar-sync/` one engine
  runs the round for every app (`engine.ts`) and one OAuth flow signs in to each (`oauth.ts`); an app is a
  `CalendarKit` (`kit.ts`): its sign-in addresses and an adapter of API calls, in `plan-data/src/google/` and
  `plan-data/src/outlook/`, each tested against a fake of the app. Its state is the app's part of `data/sync.json`,
  its client and refresh token are in `data/local.json`, both written through `store.ts`. An edit made there reaches
  the plan only as a `PlanChange` stored by `saveChanges` with the app as the source, a history step like any other.
  Server functions in `apps/web/src/server/calendars.ts` take the app as a parameter, the sign-in routes are
  `routes/api/$provider.connect.ts` and `$provider.callback.ts`, and the planner feature `calendar-sync` holds the
  integrations dialog, each app's dialog and the shared review. A new app is a kit, an entry in
  `CALENDAR_PROVIDERS`, a setup component and its messages; the engine, the routes and the review stay as they are.
- **Work that needs a heavy library** (re-balancing a calendar with the HiGHS solver):
  - **Rules and model**: pure, in `plan-domain` (`src/rebalance/`). That holds the room, an integer program in a
    neutral `LpModel` form, the placement and the report.
  - **The library**: taken as an injected function. `planRebalance` asks for a `solve`, so the domain imports no
    solver, and its tests pass a fake one.
  - **Supplying it**: `plan-data` passes the real one. `solver.ts` runs HiGHS, and `rebalance.ts` adds the busy
    calendar and runs one request at a time.
  - **Adapters**: the server function `rebalancePlan` (`apps/web/src/server/reschedule.ts`) and the MCP tool
    `rebalance_calendar` hold no rules.
  - **The module**: takes the work as an optional prop (`rebalance` on `PlannerPage`), and leaves the Re-balance
    mode out where the host passes none.
  - **Keeping it off the browser**: the web build leaves `highs` out of the bundle (`ssr.external` in
    `vite.config.ts`) and copies the package beside the server, so its loader finds `highs.wasm`.

  How the re-balance works: [rebalancing.md](rebalancing.md).
- **A shared dependency version**: the `catalog` in `pnpm-workspace.yaml`, referenced as `catalog:`.

## Trunk-based flow

Short-lived branches into `main`. CI (`.github/workflows/ci.yml`) runs `nx affected`, so only the projects a
change touches are type-checked, linted and built; results are cached locally in `.nx/cache`.
