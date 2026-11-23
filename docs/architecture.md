# Architecture

One trunk-based repository, managed by [Nx](https://nx.dev) on top of pnpm workspaces. Everything deployable
lives in `apps/`, every vertical slice of the product is a module in `modules/`, and code shared between them
is a package in `packages/`.

```
apps/
  web/                 TanStack Start shell: routes, server functions, HTML document. Composes the modules.
modules/               microfrontends, composed at build time
  planner/             the planner page: week grid, agenda, budget, runway, event editing
  calendar-export/     the export button and dialog (.ics, zip, combined calendar)
  dashboard/           the progress page at /dashboard: stat tiles and charts, read-only
packages/
  plan-domain/         the domain: types, Minsk dates, schedule rules, edits, .ics. Pure TypeScript
  plan-data/           the database on disk (data/plan.json, data/edits.json) and `pnpm run plan`. Node only
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
  headerAside={<LanguageSwitcher />}            // slot
  renderActions={({ plan, hidden }) => <ExportCalendars plan={plan} hidden={hidden} />}   // another module
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
  widgets/             self-contained blocks of a page (week grid, month grid, plan map, course progress)
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
- **Open/closed**: the planner is extended through `headerAside`, `renderActions` and `commands`, not edited, when the app
  adds an action.
- **Liskov / interface segregation**: components take the narrow data they use (`plan`, `hidden`), not a store or
  a router.
- **Dependency inversion**: modules declare callbacks (`onChange`, `onSearchChange`); the app supplies the
  implementation. The domain depends on nothing.

## Adding things

- **A feature in a module**: new slice under `features/` or `widgets/` with an `index.ts`, used from the page.
- **A module**: copy the shape of `modules/calendar-export` (`package.json` with the `type:module` tag,
  `tsconfig.json`, `src/index.ts`), add it to `apps/web/package.json` and compose it in a route. The lint rule for
  `modules/**` already refuses every `@lc/*` package except the shared ones, so nothing is added there.
- **A page**: its header is `PageHeader` from `@lc/ui`, first in the page container. Every page whose header holds
  actions or navigation keeps it on screen while the page scrolls; do not write a page header by hand.
- **A route**: a file in `apps/web/src/routes` that renders a module's page. Keep logic out of route files.
- **A server function**: `apps/web/src/server/`, using `@lc/plan-data`; pass the result into the module as props.
- **Something read from outside the plan** (the person's own calendar): fetched and parsed in `plan-data`
  (`busy.ts`), offered by a server function, and passed to the module as a prop with a `load` callback. It never
  becomes a `PlanChange`; a local setting such as its address lives in the untracked `data/local.json`, written by
  `store.ts`.
- **A shared dependency version**: the `catalog` in `pnpm-workspace.yaml`, referenced as `catalog:`.

## Trunk-based flow

Short-lived branches into `main`. CI (`.github/workflows/ci.yml`) runs `nx affected`, so only the projects a
change touches are type-checked, linted and built; results are cached locally in `.nx/cache`.
