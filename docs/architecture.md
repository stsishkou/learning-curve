# Architecture

One trunk-based repository, managed by [Nx](https://nx.dev) on top of pnpm workspaces. The plan's rules are written once
and reached through ports, so a different store, a different front end or a different host is another piece of wiring,
not a rewrite. This document says where things go and what may import what. Each project's own `README.md` says what it
holds. Where the work goes next: the [design for phases 2–4](superpowers/specs/2026-11-27-parts-interfaces-and-sign-in-design.md).

## Layers

Every project has one `type:` tag (the `nx` field of its `package.json`). A project may depend only on the layers its own
layer allows.

| Layer | Tag | May import | Never | Projects |
|---|---|---|---|---|
| app | `type:app` | every layer below | another app | `web`, `mcp`, `docs`, `docs-harness`, `stand` |
| module | `type:module` | domain, contract, shared | another module, service, infra, content, `node:*`, server functions | `planner`, `dashboard`, `calendar-export` |
| infra | `type:infra` | service, domain, content, contract | React, a module | `plan-data` |
| service | `type:service` | domain | React, `node:*`, infra, content | `plan-service` |
| content | `type:content` | domain | React, `node:*`, everything else | `plan-content` |
| domain | `type:domain` | nothing | React, Node, any workspace package | `plan-domain` |
| contract | `type:contract` | nothing | everything | `docs-contract` |
| shared | `type:shared` | contract | the plan, modules, apps | `ui`, `i18n`, `remote-host` |

`remote-host` is the one shared package that reads a contract: its `./docs` entry is the docs remote's hook. Only that
entry may import `@lc/docs-contract`; the generic loader at `.` imports no workspace package.

```
apps        web ───────────┬───────────┬──────────────┐      mcp         docs      docs-harness   stand
             │             │           │              │       │            │
modules   planner      dashboard  calendar-export     │       │            │
             │             │           │              │       │            │
infra        │        plan-data ──▶ plan-content      │       │            │
             │             ╲  ╲                       │       │            │
service      │              ╲  plan-service ◀─────────┴───────┘            │
             │               ╲      │                                    │
domain       └────────────────▶ plan-domain ◀── (modules, plan-content)   │
contract                      docs-contract ◀── remote-host/docs, docs, docs-harness, web
shared                        ui, i18n, remote-host ◀── modules, apps
```

Apps import every layer they wire, so the arrows from `web`, `mcp` and `stand` to the lower layers are left out. `web` and
`mcp` are the two composition roots of the plan: each builds `PlanPorts` from `@lc/plan-data/local` and hands them to
`createPlanServices`. `docs` and `docs-harness` belong to the guide and know nothing of the plan.

### What enforces it

1. **pnpm**: a package can only import what its `package.json` lists.
2. **`scripts/check-graph.ts`** (the first step of `pnpm run check`, plain `node`): reads the tag and the `workspace:`
   dependencies of every `apps/*`, `modules/*` and `packages/*` project and fails naming each forbidden edge
   (`@lc/dashboard → @lc/plan-data (module → infra)`), or a project without exactly one `type:` tag. It stands in for the
   Nx boundary plugin, which loads typescript-eslint and does not run on TypeScript 7.
3. **Oxlint** (`overrides` in `.oxlintrc.json`): the same rule on the import statements, including the entries
   (`@lc/plan-data/*`, `@lc/plan-service/*`), which `package.json` cannot tell apart, and which `plan-domain` entry may
   import which (below). Deep imports (`@lc/x/src/...`) and reaching into another package by relative path are refused
   everywhere.
4. **Steiger** (`steiger.config.ts`): the Feature-Sliced layers inside each module.

## Projects

```
apps/
  web/                 TanStack Start shell: routes, server functions, /api/*. Composition root of the plan.
  mcp/                 the Model Context Protocol server over stdio (`pnpm run mcp`). Composition root, thin tool adapters.
  docs/                the guide: a static site and the Module Federation remote `lc_docs`
  docs-harness/        a minimal host that proves the docs remote end to end (Playwright)
  stand/               the component stand: Storybook with every UI component, widget and feature
modules/               microfrontends, composed at build time
  planner/             the planner page, the timeline and focus pages
  calendar-export/     the export dialog (.ics, zip, combined calendar)
  dashboard/           the progress page: stat tiles and charts, read-only
packages/
  plan-domain/         the rules, pure TypeScript, several entries
  plan-content/        the owner's courses and the generator built for them
  plan-service/        ports, use cases, failures as values, the access rule, `./testing`
  plan-data/           the adapters of the ports, one entry each, and `pnpm run plan`. Node only
  docs-contract/       the docs remote's public contract (versioned)
  remote-host/         what a React host needs to show a federated module; `./docs` is the docs hook
  i18n/                messages (ru, en, es), compiled Paraglide output, locale-aware formatting
  ui/                  the UI kit and the Tailwind theme tokens
scripts/               check-graph.ts
```

### plan-domain: one package, several entries

Its `src/` is cut into areas, each with its own `index.ts` and its own entry in `package.json`. Areas depend one way:

| Entry | Area | Holds | Imports |
|---|---|---|---|
| `.` | `core` | types, Minsk dates, `PlanChange` and `applyChange`, edits, history, ids, rules, trash, occurrences | nothing |
| `./insights` | `insights` | stats, streak, forecast, lanes, reviews, re-plan, accuracy report | core |
| `./protocol` | `protocol` | the update schema, `parseChange`, the guide a model reads | core, insights |
| `./ics` | `ics` | `.ics` text and the import how-to | core |
| `./sync` | `sync` | what is written to a calendar app, what an edit there means, each app's event format | core, protocol, ics |
| `./rebalance` | `rebalance` | the room, the neutral `LpModel`, placement, the report | core |
| `./fixtures` | `fixtures` | a frozen copy of the generated plan, for tests and stories | anything in the package |

`protocol` imports `insights` because the guide reports accuracy. The fixtures are a JSON file, not the courses, so editing
a course never changes a test.

### plan-service: the application layer

- **Ports** (`src/ports/`): the interfaces every store and outside service implements: `PlanRepository`, `PlanLibrary`,
  `SyncStateStore`, `PrivateSettings`, `BusyFeedReader`, the LP solver, `CalendarConnector`, `Clock`, `HostRules`. Each says
  what every implementation guarantees. `PlanPorts` is the set a composition root passes in.
- **Use cases** (`src/services/`): `createPlanServices(ports)` builds the plan, library, busy-time, re-balance and
  calendar-sync services. A use case takes the `Actor` (who the call is for; today `LOCAL_ACTOR`), resolves the plan,
  asks `accessOf` what the actor may do and writes only when the host is writable.
- **Failures are values**: a call answers `Result<T, PlanFailure>`, never throws for an expected case. `signed-out` is 401,
  `forbidden` 403, `not-found` 404, `conflict` 409, `invalid` 422; `apps/web/src/server/respond.ts` is the one mapping to HTTP.
  A save that meets a moved revision is retried once on a fresh read; only a second conflict is reported.
- **Parsers** (`src/parse.ts`): read each use case's input from untrusted JSON, with the messages a person sees.
- **`./testing`**: the contract suites of every port (`describePlanRepository`, …) and `createMemoryPorts`, an in-memory
  `PlanPorts`. Every adapter runs them, so a new store is correct when the suites pass.

### plan-data: the adapters

One entry per adapter, so a host takes what it needs: `./fs` (plans, library, settings and sync state as files; the **only
writer** of the data files, atomically), `./ical` (the busy calendar), `./highs` (the solver), `./google`, `./outlook` (the
calendar apps), and `./local`, which wires all of them into one `PlanPorts` for a checkout. `scripts/build-plan.ts` is
`pnpm run plan`. The data directory is injected (`findDataDir`, or `PLAN_DATA_DIR`), never read from a global.

### plan-content

The owner's courses (`content.ts`) and the schedule generator (`schedule.ts`: `DEFAULT_CONFIG`, `buildPlan`). It is data: only
`plan-data/fs` and `pnpm run plan` read it, so editing a course touches no module.

## Ports and adapters

```
page ──▶ server function (adapter) ──▶ use case ──▶ port ◀── adapter (fs, ical, highs, google, outlook)
 ▲                                        │
 └── props: plan, url, abilities, slots   └── rules from plan-domain
```

A use case is written against the ports and holds the rules of the application: who may do what, what is stored, what is
sent to a calendar app. The adapters of the outside world implement the ports; the adapters of the front (server
functions, `/api/*` routes, the MCP tools, the AI chat tab) are thin and hold no rules. The same pure reducer,
`applyChange`, runs in three places: in the service before a change is stored, in the browser to show a change before the
server answers, and on a plan file opened from disk. Every edit is one `PlanChange` handled there; a new kind of edit is a
new member of that union, not a new server function.

## Modules are microfrontends composed at build time

A module is a workspace package with one public entry (`src/index.ts`). The app imports it like a library and Vite builds
everything into one deployable, so routes stay typed and server rendering works. Modules do not know about each other, the
router, or where data comes from. The app passes that in, in four groups:

```tsx
// apps/web/src/routes/index.tsx
<PlannerPage
  plan={{ view, change, changeAll, travel, trimHistory }}   // the PlanView the app loaded, and how to change it
  url={{ search, onSearchChange }}                          // URL state: the app owns the router
  abilities={{ library, rebalance, busy, sync, focus }}     // what this host can do; an absent one hides its UI
  slots={{ renderExport, commands }}                        // the host's own UI: another module, palette entries
/>
```

`PlanView` (from `plan-domain`) is the one read model the app sends to a page: the plan, what the actor may do with it
(`access`), which events were edited by hand, the trash and the history. Components take the narrow data they use, not a store or a router. That keeps each module testable
on its own, and a module could be served as a runtime remote later without restructuring: its public entry is already the
federation boundary.

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

## When a folder becomes a package

A folder with its own public entry is the default. It becomes a package only when at least one holds:

1. It belongs to another layer, so it may import different things.
2. A deployable needs it without its current neighbours.
3. It changes on a different cadence for different consumers, so keeping it inside marks unrelated projects affected.

`plan-service` meets (1), `plan-content` (3). The Google, Outlook, HiGHS and iCal adapters meet none: they share
`plan-data`'s layer and their only consumers are the composition roots, so they are entries there. The same test answers
"should insights become a package" when it comes up.

## Adding things

- **A use case**: a method of the matching service in `plan-service/src/services/` (or a new service in `create.ts`),
  written against the ports, returning `Result<T, PlanFailure>`, taking the `Actor`, with its input read in `parse.ts`
  if it comes from outside. Test it with `createMemoryPorts`. Then add one thin server function in `apps/web/src/server/`
  and, if an assistant needs it, a tool in `apps/mcp/src/tools.ts` and `server.ts`. Put no rule in either.
- **A kind of edit**: a member of `PlanChange` and its case in `applyChange` (`plan-domain/src/core/changes.ts`), with its
  schema, its line of the guide and its case in `parseChange` (`protocol/`): they describe one protocol, and
  `pnpm run test` fails when they drift.
- **A port**: an interface in `plan-service/src/ports/` with TSDoc naming what every implementation guarantees, a member of
  `PlanPorts`, and a contract suite in `plan-service/src/testing/contracts/`. Implement it in an adapter entry of
  `plan-data` and run the suite there; `createMemoryPorts` gets an in-memory one.
- **An adapter**: a folder in `plan-data/src/` with its own `index.ts`, an entry in its `package.json` and, if it takes
  part in `localPorts`, a line in `local/index.ts`. It may import the service (to implement a port), the domain and the
  content; nothing above. A calendar app is a `CalendarConnector`: its sign-in addresses and an adapter of API calls, in
  its own entry, tested against a fake of the app. Only the app's pure rules live in `plan-domain/sync`.
- **A page**: it draws no header. The app's root route renders one bar for every route (`ShellBar`, built on `AppBar` from
  `@lc/ui`): the sections, Expand and Full screen, and a settings panel with the language, the theme, the display switches
  and the links about the app. Moving between pages never moves it. A page names itself with an `sr-only` `h1`; a control
  only it needs goes in its own content, its `⋮` menu or a `Hint`, never in the bar. A page laid out wide hides the bar and
  shows Collapse in its own top row. The page itself is a slice of a module (`pages/`), a file route in
  `apps/web/src/routes` renders it, and the route keeps no logic.
- **A module**: copy the shape of `modules/calendar-export` (`package.json` with the `type:module` tag, `tsconfig.json`,
  `src/index.ts`, a `README.md`), add it to `apps/web/package.json` and compose it in a route. The lint rule for
  `modules/**` already refuses every `@lc/*` package except domain, UI and i18n.
- **A server function**: `apps/web/src/server/`, calling `services` (built once in `services.ts`); the result goes into the
  module as props. Failures leave through `respond.ts`.
- **Something read from outside the plan** (the person's own calendar): fetched and parsed by an adapter (`plan-data/ical`)
  behind the `BusyFeedReader` port, offered by the busy-time service, and passed to the module as a prop with a `load`
  callback. It never becomes a `PlanChange`; a local setting such as its address lives in the untracked `data/local.json`.
- **Work that needs a heavy library** (re-balancing with the HiGHS solver): the rules and the model are pure, in
  `plan-domain/rebalance`; the library is an injected function (`planRebalance` asks for a `solve`, so the domain imports no
  solver, and its tests pass a fake); `plan-data/highs` supplies the real one through `PlanPorts.solve`; the re-balance
  service adds the busy calendar and runs one request at a time. The server function and the MCP tool hold no rules, the
  module takes the work as an optional `abilities.rebalance` and leaves the mode out where the host passes none. The web
  build leaves `highs` out of the bundle (`ssr.external` in `vite.config.ts`) and copies the package beside the server, so
  its loader finds `highs.wasm`. How it works: [rebalancing.md](rebalancing.md).
- **State kept for the calendars that read the plan** (the version of each event in the feeds): the untracked
  `data/sync.json`, written only by `plan-data/fs`; the rules that compute it are pure, in `plan-domain/core`
  (`revisions.ts`). A calendar app's tokens and client are in `data/local.json`. An edit made in an app reaches the plan only
  as a `PlanChange` stored by the plan service with the app as its source, a history step like any other.
- **A shared dependency version**: the `catalog` in `pnpm-workspace.yaml`, referenced as `catalog:`.
- **A backend** comes in as another directory under `apps/` with its own `Dockerfile`. Nx runs any project with a
  `package.json` or `project.json`, so a Python service takes part in `nx affected` like the TypeScript ones. A contract
  shared with it goes in a `type:contract` package.

## Where the files are

| File | Written by | Tracked |
|---|---|---|
| `packages/plan-data/data/plan.json` | `pnpm run plan` and `plan-data/fs` | yes; generated, never hand-edited |
| `packages/plan-data/data/edits.json` | `plan-data/fs` | yes; the owner's manual edits |
| `packages/plan-data/data/history.json` | `plan-data/fs` | no; undo and redo steps |
| `packages/plan-data/data/sync.json` | `plan-data/fs` | no; calendar sync state |
| `packages/plan-data/data/local.json` | `plan-data/fs` | no; secrets and the busy-feed address |
| `packages/plan-data/data/library/` | `plan-data/fs` | no; plan files with versions |

## How the principles map

- **Single responsibility**: one reason to change per project: the rules (`plan-domain`), the owner's courses
  (`plan-content`), what the application does with them (`plan-service`), where they are kept (`plan-data`), how it looks
  (`ui`), what it says (`i18n`), one user-facing area (each module).
- **Open/closed**: a new store, calendar app or front end is a new adapter or a new composition root; the use cases stay.
  The planner is extended through its `slots` and `abilities`, not edited, when the app adds something.
- **Liskov / interface segregation**: a port is the narrow thing a use case needs, and every implementation passes the same
  contract suite, so any of them can stand in for another.
- **Dependency inversion**: the service declares the ports and the modules declare callbacks; the composition root supplies
  the implementations. The domain depends on nothing: even the solver is passed in.

## Trunk-based flow

Short-lived branches into `main`. CI (`.github/workflows/ci.yml`) runs `nx affected`, so only the projects a change touches
are type-checked, linted and built; results are cached locally in `.nx/cache`.
