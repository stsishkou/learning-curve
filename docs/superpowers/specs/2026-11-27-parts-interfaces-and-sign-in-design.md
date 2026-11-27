# Parts, interfaces and sign-in

Status: proposed, 2026-11-27. Covers the target structure of the workspace and the order to reach it. Each phase
below gets its own implementation plan; phase 1 first.

## Why

The owner wants the workspace split into parts that each have one job, a small strictly typed interface with
documentation, and arrows in `nx graph` that read as an obvious layering. A part becomes its own app when that makes
it more robust. A package is created only where its boundary pays for itself (locality first); otherwise a folder
with its own public entry is enough.

Two things are coming that the current shape cannot take without copying code:

- **A server and an API besides the JSON files.** Storage has to sit behind an interface so a database or a remote
  API can replace the files without touching anything else.
- **Accounts.** Sign-in with email and password, Google and Microsoft. Anyone can make an account, so it comes with
  email verification, password reset by mail, limits on repeated attempts, and Google's review of calendar access.
  The sign-in UI is a separate micro: when a call finds no session, the page opens sign-in in a drawer or dialog in
  place, the way the docs drawer opens today, and carries on after.

## What is there today

Measured on `develop` at `f58113f`.

- **The graph is already acyclic and layered**: `web → modules → plan-domain, ui, i18n` and
  `web → plan-data → plan-domain`. The trouble is width, not wrong arrows.
- **`@lc/plan-domain`** (7.9k lines, one 290-line `index.ts`) holds about six areas: the plan model with edits,
  changes, history and trash; the update protocol (`update`, `schema`, `guide`); insights (`accuracy`, `forecast`,
  `goals`, `replan`, `stats`, `streak`, `reviews`, `lanes`); calendar sync rules with the Google and Outlook mapping;
  the re-balance model; `.ics`. It also holds the owner's courses (`content.ts`) and the generator built for them
  (`buildPlan`, `DEFAULT_CONFIG` in `schedule.ts`). Every plan-related project depends on it, so editing one course
  marks almost the whole workspace affected. Some core files reach into other areas: `changes.ts` imports
  `weekReview` from `goals` and `SessionMove` from `replan`, `history.ts` imports the provider guard from
  `calendar-sync`, and `calendar-sync.ts` imports `previewUpdate` from `update`.
- **`@lc/plan-data`** is free functions bound to `node:fs`, with file paths fixed when the module loads and every
  call synchronous. It mixes storage (`store.ts`, `library.ts`), the use cases on top of it (`saveChanges` records
  history), OAuth and the Google and Microsoft API clients, the HiGHS solver, the busy-feed reader, the
  `pnpm run plan` script and the MCP server (`scripts/mcp.ts`).
- **The use cases have no home.** `apps/web/src/server/*.ts`, `routes/api/plan-update.ts` and `scripts/mcp.ts` each
  recombine `canWrite`, `readPlan`, `saveChanges`, `writePlan`, `writeHistory`; `travelPlanHistory` in the app is
  real application logic; `mustWrite` is copied three times; input validators are written by hand per server
  function. An HTTP API would be a fourth copy.
- **The same read model is declared twice**: `PlanState` in `apps/web/src/server/plan.ts` and `PlannerState` in
  the planner's `use-plan-session.ts`.
- **`@lc/planner`** is 17.5k lines: three pages (planner, focus, timeline) and 20 features. `PlannerPage` takes
  about 15 separate props and callbacks. Splitting it by page does not pay: focus and timeline use
  `features/reschedule` and `shared/*` together with the planner page, and modules may not import each other, so a
  split would only move those into new packages that exist to be shared.
- **The docs drawer is the precedent for a micro opened in place**: `apps/docs` builds a Module Federation remote
  (`lc_docs/help`), `@lc/docs-contract` holds its versioned contract, `@lc/docs-host` loads it on first click with a
  timeout, a shape check and a version check, and falls back to a link when it cannot.
- **Calendar sign-in uses the person's own OAuth client**: they paste a client id and secret, kept with the refresh
  token in the untracked `data/local.json` (`calendar-sync/oauth.ts`). That cannot work for many people.
- Only `apps/docs` has a README. `docs/architecture.md` does not mention `apps/docs`, `apps/docs-harness`,
  `apps/stand`, `@lc/docs-contract` or `@lc/docs-host`.

## Goals

- Every part has one reason to change, a public entry whose exports are documented, and a place in a layer that
  lint and a graph check enforce.
- Storage, outside services and identity are reached only through interfaces (ports) owned by the application
  layer. The JSON files are one implementation; a database or an HTTP API is another, swapped in the composition
  root.
- One implementation of each operation on a plan, called by every entry point: server functions, HTTP routes, the
  MCP server, later the API app.
- Accounts: email and password with verification and reset, Google, Microsoft; sessions checked on the server for
  every call; sign-in shown in place by a separately deployable micro that never leaves a person unable to sign in.
- Parts that benefit from running alone become apps: the MCP server now, the sign-in remote with accounts, the API
  and a calendar-sync worker later.

## Non-goals

- Changing what the planner, dashboard or export do, beyond what accounts need (an account button, sign-in in
  place, a person's own plan).
- Sharing a plan with other editors, teams, roles beyond owner and reader, billing, an admin UI, two-factor sign-in
  and passkeys. The design leaves room for them; none is built.
- Loading the planner or dashboard at run time. They stay build-time modules.
- Leaving TanStack Start, Nx, pnpm, Oxlint or Steiger.

## Anti-goals

Any of these is a failure even if everything works:

- A package per folder. A package whose only consumer is one other package in the same layer should have been a
  folder.
- Ports shaped like files (`readEditsJson`, `writeLocal`) instead of operations a database could serve.
- Rules in adapters: server functions, routes, MCP tools, Better Auth hooks and the fs store translate and wire,
  nothing else.
- Sign-in that is unavailable because a remote failed to load.
- Any visible change in phase 1.

## Constraints

- TypeScript 7 has no compiler API: the Nx boundary plugin and typescript-eslint do not run. Enforcement stays with
  pnpm dependencies, Oxlint overrides and Steiger, plus the graph check below.
- Strict types: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no `any`, `as` or `!`.
- Packages are consumed as TypeScript source; no path aliases inside `modules/*` and `packages/*`.
- Every edit is a `PlanChange` applied by `applyChange`; the update protocol (`schema.ts`, `guide.ts`,
  `parseChange`) changes together and its drift tests keep running.
- UI text in ru, en and es through Paraglide; plan content stays Russian; times through the Minsk helpers.
- Node 26 (so `node:sqlite` is available).
- The owner's workflow keeps working: edit courses, `pnpm run plan`, tracked `plan.json` and `edits.json`.

## Approaches

1. **Ports and adapters at the real seams, entries elsewhere (chosen).** Add an application layer
   (`@lc/plan-service`) that owns the ports and the use cases; turn `plan-data` into adapters; move the owner's
   courses out of the domain; give `plan-domain` several public entries instead of new packages; add the account
   parts. About 7 new projects by the end of phase 2, each with a different layer, dependency set or deployable.
2. **A package per area.** Split `plan-domain` into six packages and `planner` into three modules plus shared
   feature packages. `nx affected` gets finer, but it adds about 12 projects, the cross-area imports listed above
   become package cycles to untangle first, and features shared by two pages need packages that exist only to be
   shared. It works against locality first.
3. **Separate services now.** `apps/api`, a standalone auth service on its own origin and a worker from day one,
   with the web app a pure client over HTTP. Most robust under load, but three deployments and a network hop per
   edit before there is a second user, and sign-in in place gets harder: a session cookie from another site is a
   third-party cookie that browsers block.

Approach 1 reaches approach 3's deployables in phase 4, when there is a reason to; the ports make that a wiring
change.

## Target layout

### Layers

| Tag | May import | Never | Projects |
|---|---|---|---|
| `type:app` | anything below | another app | `web`, `mcp`, `auth`, `docs`, `docs-harness`, `stand`; later `api`, `sync-worker` |
| `type:module` | domain, contract, shared | another module, service, infra, `node:*` | `planner`, `dashboard`, `calendar-export`, `sign-in`; phase 3 `calendar-sync` |
| `type:infra` | service, domain, content, contract | React, modules | `plan-data`, `auth-server` |
| `type:service` | domain | React, `node:*`, infra, contract | `plan-service` |
| `type:content` | domain | everything else | `plan-content` |
| `type:domain` | nothing | everything | `plan-domain` |
| `type:contract` | nothing | everything | `docs-contract`, `auth-contract` |
| `type:shared` | nothing in the workspace | the plan, modules, apps | `ui`, `i18n`, `remote-host` |

### Projects

New or changed projects, by the end of phase 2:

| Project | Status | Job |
|---|---|---|
| `packages/plan-domain` | changed | The plan's rules, pure. Several public entries (below). Loses the owner's courses and generator. Gains `PlanId`, `UserId` and the read model `PlanView`. |
| `packages/plan-content` | new | The owner's courses and the generator built for them (`content.ts`, `buildPlan`, `DEFAULT_CONFIG`): data, read only by the fs store and `pnpm run plan`. Editing a course no longer touches the modules. |
| `packages/plan-service` | new | The application layer: ports, use cases, failures, the access rule; `./testing` with in-memory adapters and port contract suites. Pure TypeScript. |
| `packages/plan-data` | changed | Node adapters for the ports, one entry each: `./fs` (plans, library, sync state, settings in JSON files; the only writer of those files), `./highs`, `./ical`, `./google`, `./outlook`. Keeps `pnpm run plan`. Loses the use cases and the MCP server. |
| `packages/auth-contract` | new | The sign-in remote's contract: version, what the remote exports, the host object, events, `SessionUser`. Types and guards only. |
| `packages/auth-server` | new | Accounts on the server: a factory around Better Auth, the request handler for `/api/auth/*`, the actor of a request, the `Mailer` port and its dev adapter. No other project imports Better Auth's server API. |
| `packages/remote-host` | renamed from `docs-host` | `.`: the generic loader of a federated module (timeout, shape guard, contract version) and its React hook; `./docs`: today's docs hook built on it. |
| `modules/sign-in` | new | The sign-in UI, Feature-Sliced: password sign-in, sign-up, verification notice, forgot and reset password, Google and Microsoft through a popup, the account panel. Its entry implements the `auth-contract` remote API. |
| `apps/auth` | new | Builds `modules/sign-in` as the federation remote `lc_auth` (`./sign-in`) under `remote/v<major>/`, a static deployment like the docs remote. |
| `apps/mcp` | new | The MCP server, moved from `plan-data/scripts/mcp.ts`: a composition root plus thin tool adapters. |
| `apps/web` | changed | Composition root and thin adapters: server functions, `/api/*` routes, `/api/auth/*`, the sign-in host in the shell. |

`docs/architecture.md` is rewritten for this layout and covers every app.

### The graph

```
apps        web ─────────┬──────────┬───────────┐      mcp        auth      docs  docs-harness  stand
             │           │          │           │       │           │
modules     planner  dashboard  calendar-export  sign-in ◀──────────┘
             │           │          │           │
infra        │    plan-data ──▶ plan-content   auth-server
             │       │    ╲                       │
service      │       │     plan-service ◀─────────┘
             │       │        │
domain       └───────┴──▶ plan-domain ◀── (modules, plan-content)
contract                  auth-contract, docs-contract   ◀── modules, apps, auth-server
shared                    ui, i18n, remote-host          ◀── modules, apps
```

Apps import every layer they wire; the arrows from `web`, `mcp` and `stand` to the lower layers are left out of the
drawing for clarity.

### When a folder becomes a package

A folder with its own public entry is the default. It becomes a package only when at least one holds:

1. It belongs to another layer, so it may import different things.
2. A deployable needs it without its current neighbours.
3. It changes on a different cadence for different consumers, so keeping it inside marks unrelated projects
   affected.

`plan-service` meets (1), `plan-content` (3), `auth-server` and `auth-contract` (1) and (2), `sign-in` and the new
apps (2). The Google, Outlook, HiGHS and iCal adapters meet none: they share `plan-data`'s layer and its only
consumers, the composition roots, so they are entries there. The same test answers "should insights become a
package" later.

## `@lc/plan-domain`: one package, several entries

| Entry | Holds | May import |
|---|---|---|
| `@lc/plan-domain` | types, ids (`PlanId`, `UserId`), `PlanView`, dates, recurrence, occurrences, edits, changes, history, trash, labels, progress, diff, revisions, deadlines, rules, free slots, quick events, `weeklyHours` | nothing |
| `./protocol` | the update protocol: `update`, `schema`, `guide`, `parseUpdate` | core |
| `./insights` | accuracy, accuracy report, forecast, goals, replan, stats, streak, reviews, lanes, course plan | core |
| `./ics` | `.ics` building | core |
| `./sync` | calendar sync rules, Google and Outlook mapping | core, protocol, ics |
| `./rebalance` | the re-balance model and `Solve` | core |
| `./fixtures` | test plans, built from a small fixed set of events, not from the owner's courses | core |

To get there, the core stops importing other areas: `SessionMove` and the provider guard move to core, and the
part of `weekReview` that `changes.ts` needs moves to core or the `week.review` change carries it. Oxlint forbids
an entry from importing an entry not listed for it. Domain tests that call `buildPlan()` today switch to fixtures.

`PlanView` replaces both `PlanState` and `PlannerState`:

```ts
/** What a person sees of one plan: the plan with its edits applied, and what they may do with it. */
export interface PlanView {
  readonly id: PlanId
  readonly name: string
  readonly plan: Plan
  /** `owner` may edit; `reader` sees a read-only plan (the host's public plan, or any plan on a read-only host) */
  readonly access: 'owner' | 'reader'
  /** Uids of events that differ from the generated schedule */
  readonly edited: readonly string[]
  /** Removed events and calendars that can still be restored */
  readonly trash: PlanTrash
  /** The steps of the history and how many of them are applied */
  readonly history: HistoryView
}
```

Ids are branded strings made only by guards, so no cast is needed anywhere:

```ts
declare const planIdBrand: unique symbol
/** The id of a stored plan. */
export type PlanId = string & { readonly [planIdBrand]: true }
/** True for a string shaped like a plan id; the only way to get a `PlanId`. */
export function isPlanId(value: string): value is PlanId
```

## `@lc/plan-service`: the application layer

### The actor

```ts
/**
 * Who a call is made for. The server resolves it from the session cookie or an API key; it is never read from a
 * request body or a URL.
 */
export type Actor = { readonly kind: 'person'; readonly userId: UserId } | { readonly kind: 'anonymous' }
```

### Ports

Each port is an interface in `plan-service`, documented with the guarantees every implementation keeps. All are
async. Sketch, not final names:

```ts
/** Where plans are kept. The only way a use case reads or writes a plan: JSON files now, a database later. */
export interface PlanRepository {
  /** The plan, or null when no plan has this id. */
  get(id: PlanId): Promise<StoredPlan | null>
  /** The plans a person owns, oldest first, so the first is their default plan. */
  listOwned(owner: UserId): Promise<readonly PlanSummary[]>
  /** The plan whose secret feed token this is, or null. */
  byFeedToken(token: FeedToken): Promise<StoredPlan | null>
  create(plan: NewPlan): Promise<StoredPlan>
  /**
   * Replaces the edits and the history together, or neither. `conflict` when the plan was written after
   * `expected` was read: by this process, another one (the MCP server) or `pnpm run plan`.
   */
  save(id: PlanId, next: PlanWrite, expected: Revision): Promise<Revision | 'conflict'>
  /** Gives the plan a new secret feed token; the old one stops working. */
  rotateFeedToken(id: PlanId): Promise<FeedToken>
  remove(id: PlanId): Promise<void>
  /** Removes every plan the person owns, when their account is deleted. */
  removeAllOf(owner: UserId): Promise<void>
}

/** A plan as stored: the generated base, the edits on top, their history, and the revision of this read. */
export interface StoredPlan {
  readonly id: PlanId
  /** Null for the owner's `default` plan on an accounts host before the `OWNER_EMAIL` account exists */
  readonly owner: UserId | null
  readonly name: string
  /** The secret part of the plan's calendar feed addresses (accounts mode) */
  readonly feedToken: FeedToken
  readonly base: Plan
  readonly edits: PlanEdits
  readonly history: PlanHistory
  readonly revision: Revision
}
```

The other ports, one line each here, documented the same way in code:

| Port | Job | Phase-1 adapter |
|---|---|---|
| `PlanLibrary` | a person's saved plan files and their versions | `plan-data/fs` (today's `library.ts`) |
| `SyncStateStore` | per plan: what each feed and each calendar app was last given | `plan-data/fs` (`sync.json`) |
| `PrivateSettings` | per person: settings that never reach the browser (the busy-calendar address) | `plan-data/fs` (`local.json`) |
| `BusyFeedReader` | busy blocks of an iCal address in a range | `plan-data/ical` |
| `Solve` | an LP solver (already a type in the domain) | `plan-data/highs` |
| `CalendarConnector` | one calendar app's API calls in the sync rules' terms (today's `CalendarKit` adapter) | `plan-data/google`, `plan-data/outlook` |
| `CalendarTokens` | an access token to a person's calendar app, renewed when asked | phase 1: `plan-data/fs` (today's `oauth.ts`); phase 3: `auth-server` |
| `Clock` | the current time | `Date.now` |
| `PlanSaved` | told after every save; the calendar sync listens | wired in the composition root |

`PlanLibrary`, `SyncStateStore` and `PrivateSettings` also have `removeAllOf(owner)`, for account deletion.

`plan-data/fs` takes its data directory as an argument from the composition root; nothing is resolved when a
module loads. It is the only code that writes the data files, as `store.ts` is today.

### Use cases

```ts
/** Builds the services from their ports. Called once by each composition root (web, mcp, later api). */
export function createPlanServices(ports: PlanPorts): PlanServices

export interface PlanService {
  /** The plan as `actor` may see it. */
  view(actor: Actor, plan: PlanId): Promise<Result<PlanView, PlanFailure>>
  /** Stores the changes in order, each a step of the history; none when one does not fit. */
  apply(actor: Actor, plan: PlanId, changes: readonly PlanChange[], source?: StepSource): Promise<Result<PlanView, PlanFailure>>
  /** What the changes would do; nothing is stored. */
  preview(actor: Actor, plan: PlanId, changes: readonly PlanChange[]): Promise<Result<UpdatePreview, PlanFailure>>
  /** Moves the plan to a step of its history: 0 is before the first change. */
  travel(actor: Actor, plan: PlanId, cursor: number): Promise<Result<PlanView, PlanFailure>>
  trimHistory(actor: Actor, plan: PlanId): Promise<Result<PlanView, PlanFailure>>
  /** Moves whenever the plan is written, by anyone; the page polls it to notice writes made elsewhere. */
  revision(actor: Actor, plan: PlanId): Promise<Result<Revision, PlanFailure>>
}
```

Beside it: `LibraryService`, `BusyService`, `RebalanceService`, `AccuracyService` and `CalendarSyncService` (today's
`engine.ts`, rewritten against the ports). A save that meets `conflict` is retried once on a fresh read; a second
conflict returns the failure.

### Failures are values

```ts
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

export type PlanFailure =
  /** Needs a person and nobody is signed in */
  | { readonly kind: 'signed-out' }
  /** Signed in, but may not do this: a reader editing, or any edit on a read-only host */
  | { readonly kind: 'forbidden' }
  /** No such plan, or a private plan of someone else: the two look the same from outside */
  | { readonly kind: 'not-found' }
  /** Written elsewhere twice while this call ran */
  | { readonly kind: 'conflict' }
  /** A change that does not fit the plan, with its place in the list */
  | { readonly kind: 'invalid'; readonly index: number; readonly message: string }
```

Each transport maps a failure once, in the app: HTTP status 401, 403, 404, 409, 422; an MCP tool error; for server
functions, an error the client recognizes, where `signed-out` opens sign-in. This replaces the three `mustWrite`
copies and the status handling in `plan-update.ts`.

### Who may do what

A pure function in `plan-service`, used by every use case. It takes the actor, the stored plan and the host's
configuration (read-only or not, the public plan's id):

- The owner reads and writes their plan.
- Anyone, signed out included, reads the host's public plan (`PUBLIC_PLAN_ID`). Nothing else is public.
- A caller holding a plan's secret feed token reads that plan's calendar feeds, and nothing else of it.
- Every other plan is `not-found`.
- On a host started read-only (today's `PLAN_READONLY=1`) the owner is a reader too.

That keeps today's public read-only host: the owner's plan as the public plan, the host read-only.

### Adapters stay thin

A server function, a route or an MCP tool does three things: parse the input with the one parser for it (from the
domain or the service, replacing the hand-written validators in `apps/web/src/server/*.ts`), call one use case with
the actor, and map the result. In phase 1 the actor is always the local owner, so behaviour does not change; phase 2
swaps in the session.

### Testing kit

`@lc/plan-service/testing` exports in-memory adapters of every port and a contract suite per port
(`describePlanRepository(make)` and so on). Each real adapter runs the same suite, which is what makes them
interchangeable in practice. Module tests and stand stories use the in-memory adapters.

## `@lc/plan-content`: the owner's plan as data

`content.ts`, `buildPlan` and `DEFAULT_CONFIG` move here unchanged, typed with the domain's types. Only the fs store
(to regenerate the owner's base plan) and `pnpm run plan` read it. In the fs store, the owner's plan is the plan
with id `default`, kept in today's tracked files. `CLAUDE.md` and the architecture doc then name this package as the
place to edit courses.

## Modules

- **`PlannerPage` takes grouped interfaces instead of about 15 props**, each declared and documented in the
  planner's public entry. Direction, names left to the builder:
  - `plan`: the `PlanView` and the operations on it (`change`, `changeAll`, `travel`, `trimHistory`);
  - `url`: `search` and `onSearchChange`;
  - `abilities`: the optional `library`, `busy`, `rebalance` and `focus`; the page leaves out what is not passed,
    as it does now;
  - `slots`: `renderExport`, `renderIntegrations`, `commands`.
- **Focus and timeline stay in the planner** for the reason under "What is there today". A split becomes right when
  a page stops sharing features with the others.
- **The integrations UI leaves the planner in phase 3** as `modules/calendar-sync`, rendered through the
  `renderIntegrations` slot, the way `calendar-export` is. It is rewritten in phase 3 anyway.

## Sign-in

### Two ways to run

Accounts are switched on by configuration (`AUTH_MODE`), so the owner's own checkout keeps working as it does now.

- **`local`** (the default, and the only mode in phase 1): no accounts, no sign-in. Every call is made by the local
  owner, who owns `default` in the tracked files. The MCP server needs no key, and `.mcp.json`, `CLAUDE.md`'s
  advice to use MCP or `POST /api/plan-update`, and the planner's assistant prompts stay as they are. The feed
  addresses, `BUSY_ICS_URL`, the calendar-app clients in `local.json` and their environment variables all work
  unchanged. `auth-server` is not started.
- **`accounts`**: a hosted copy where people sign up. Every call is checked against a session or API key. `default`
  has no owner, and nobody can write it, until the `OWNER_EMAIL` account exists and claims it. A real mail sender
  is required.

The two keep separate data. A plan moves between them as a plan file (export, then open), which the library
already does. Edits made on a hosted copy never reach the tracked `edits.json`.

The composition root picks the actor source from the mode: a fixed local owner, or `auth-server.actorOf`. Phase 1
builds only the first, behind the same seam.

### Parts

- **`@lc/auth-contract`**: `AUTH_CONTRACT` (semver; a host accepts one major), the remote's export
  `SignInModule { version; createSignIn(options): SignInHost }`, the host object
  (`open(request)`, `close()`, `update(context)`, `on(event, handler)`, `destroy()`), the events
  (`auth:ready`, `auth:signed-in { user }`, `auth:signed-out`, `auth:close { reason }`, `auth:error`), the context
  (locale, theme, tokens, the auth endpoint on the host's origin, the providers on offer), and why it is opened:
  `required`, `expired`, `verified`, `reset-password { token }`, `account`. No Better Auth type appears in it.
- **`modules/sign-in`** renders into a shadow root like the docs drawer, and talks to the auth endpoint only from its
  `api/` segment, so a change of auth library touches one segment.
- **`apps/auth`** builds it as the remote. The web app loads the remote on first need through `@lc/remote-host`.
  When the remote cannot load, the web app imports `@lc/sign-in` lazily from its own bundle instead: the same
  module, the version the app was built with. Sign-in is therefore never unavailable, and the remote still lets the
  sign-in UI ship without redeploying the app.
- **`@lc/auth-server`** wraps [Better Auth](https://better-auth.com) (1.6 stable, 1.8 in beta on 2026-11-27; it
  supports Node's built-in `node:sqlite` and TanStack Start). Accounts, sessions and rate-limit counters live in an
  untracked SQLite file in the data directory.

```ts
/** Accounts on the server. Built once by a composition root; the only code that touches Better Auth's server API. */
export interface AuthServer {
  /** Answers every request under `/api/auth/*`: sign-in, sign-up, provider callbacks, verification, reset. */
  handle(request: Request): Promise<Response>
  /** The actor of a request, from its session cookie or API key; anonymous when it has neither. */
  actorOf(headers: Headers): Promise<Actor>
  /** The signed-in person for the app bar, or null. Nothing secret. */
  sessionUser(headers: Headers): Promise<SessionUser | null>
}

/**
 * Sends one mail. Two adapters: SMTP, configured from the environment and required in accounts mode (which provider
 * is the owner's choice when deploying); and for development, one that prints the link to the server log and writes
 * `data/outbox/*.eml`.
 */
export interface Mailer {
  send(mail: { readonly to: string; readonly subject: string; readonly text: string; readonly html: string }): Promise<void>
}
```

`createAuthServer` also takes two callbacks, which the composition root points at `plan-service`: one run when a
person is created, to make their first plan, and one run when an account is deleted, to forget everything the
person owns. `auth-server` never imports the use cases.

### Flows

```
call needs a person ──▶ server answers signed-out ──▶ host opens the drawer (required)
      ▲                                                     │
      └──────── retried once ◀── auth:signed-in ◀───────────┘   closed without signing in: the call fails
```

- **Password**: the drawer posts to `/api/auth/*` on the host's origin, which sets the session cookie. No
  cross-site cookie is involved, because the remote's code runs in the host's page.
- **Sign-up**: a verification mail with a link back to the app (`?auth=verified`). The shell opens the drawer with
  that request, and the person is signed in after verifying.
- **Google and Microsoft**: the click opens a popup window at once (so the popup blocker allows it), then points it
  at the provider. The provider returns to `/api/auth/callback/<provider>`, which sets the cookie and lands on a
  small completion page on the host's origin. That page tells the drawer over a `BroadcastChannel` and closes. When
  the popup is blocked, the whole page goes to the provider and comes back to where it was.
- **Forgot password**: a mail link `?auth=reset&token=…`; the shell opens the drawer in reset mode. The request
  answers the same for an unknown address.
- **Account and sign-out**: one account button in the app bar (the bar is the same on every page), opening the
  drawer's account panel: name, email, linked Google and Microsoft accounts, keys for tools, sign out, delete
  account.
- **Server rendering**: the root route loads `sessionUser` so the bar renders signed in or out without a flash.

### Plans per person

- **One plan per person.** The server picks it: the person's default plan. No plan id appears in a URL or a
  server-function input, so the planner, focus, timeline and dashboard routes keep their shape. The plan-file
  library stays what it is: saved versions, opened read-only or saved over the plan.
- A new person gets one empty plan.
- Signed in, a person sees their own plan at `/`. Signed out, a visitor sees the host's public plan when one is
  configured (`PUBLIC_PLAN_ID`), otherwise an empty page with Sign in.
- In accounts mode, the existing plan (`default`) belongs to the account whose address is `OWNER_EMAIL`, claimed when
  that account is first created.
- An API key acts on its owner's plan.

### Calendar feeds and the other public routes

Calendar apps that subscribe to a feed send no cookie, so in accounts mode a feed address carries the plan's secret
feed token: `/api/ics/<token>/<calendarId>` and the zip beside it, as Google and Outlook do for their own secret
addresses. The account panel shows the addresses and can make a new token, which stops the old addresses. In local
mode the addresses stay as they are today.

`/api/plan`, `/api/plan-accuracy`, `/api/plan-guide` and `/api/plan-update` act for the caller (session or API key)
on the caller's plan. `/api/plan-schema` holds no plan data and stays open.

### Calendar apps before phase 3

In accounts mode, until phase 3, only the `OWNER_EMAIL` account gets the integrations: the dialog, the connect and
callback routes, and the clients and tokens in `local.json`. Other people do not see them. That avoids per-person
work that phase 3 would delete, and keeps one person's plan out of another person's calendar. The busy-calendar
address is per person from phase 2, through `PrivateSettings`.

### Deleting an account

The person confirms with a fresh sign-in. Everything they own goes at once: their plan, library files, history,
sync state, settings, feed tokens, API keys and linked Google and Microsoft accounts. There is no grace period:
the person asked for it, and has just signed in again to confirm. The `OWNER_EMAIL` account cannot be deleted from
the app, because its plan is the tracked files; the panel says so.

### The MCP server and scripts

- `pnpm run plan` is a maintenance script for the owner and keeps direct access to the files.
- In local mode `apps/mcp` acts for the local owner, as today.
- In accounts mode it acts for the person whose API key is in `LC_API_KEY`. Keys are made in the account panel
  (Better Auth's API key plugin), and `auth-server.actorOf` checks them. The planner's assistant prompts tell the
  person to make one. In phase 4 the MCP server becomes a client of `apps/api` with the same key.

### Security

- The session cookie is `HttpOnly`, `Secure` outside development and `SameSite=Lax`, on the app's own origin;
  `trustedOrigins` is that origin.
- Passwords are hashed by Better Auth. Sign-in, sign-up, verification and reset are rate-limited, with the counters
  in the database so they hold across processes.
- The server decides access on every call from the actor; a user id from the browser is never trusted.
- The remote's manifest address comes from server configuration, as the docs remote's does. Its origin goes into
  the content security policy's `script-src`.
- OAuth tokens (phase 3) are stored encrypted.

## Phase 3: calendars through the sign-in

- The app registers one Google OAuth client and one Microsoft Entra app (any account, personal included). Their ids
  and secrets come from the environment.
- Signing in asks only who the person is. Connecting a calendar links the same provider with the calendar scope
  added (Microsoft also needs `offline_access`), and Better Auth keeps the tokens.
- `auth-server` implements `CalendarTokens`. The sync service keeps its rules and asks that port for tokens.
- Removed: the client id and secret form, `calendar-sync/oauth.ts`, `/api/$provider/connect` and `callback`, the
  clients in `local.json`.
- The integrations UI moves to `modules/calendar-sync`.
- Google must verify the app before people outside a test list of up to 100 can grant calendar access. That
  verification is the owner's to request, and it gates this phase's release to everyone.

## Phase 4: parts that run alone

Each gets its own design when started; the ports make each a wiring change.

- **`apps/api`**: a versioned HTTP API (`/v1/…`) over the same services; the `/api/plan-*` routes move there. A
  package `@lc/plan-api` with `./server` (routes as functions) and `./client` (`PlanService` over HTTP), so the web
  app and the MCP server can call it with the same interface they call in process today.
- **`apps/sync-worker`**: calendar rounds on a schedule and after saves, with retries, so a slow or down Google or
  Microsoft never rides on a person's request.
- **`plan-data/sql`**: plans in a database, passing the same port contract suites.

Not made an app, and why: the auth endpoints stay mounted in the app's own server, because a session cookie must be
first-party for sign-in in place to work. The solver stays in process: it runs per request, and it can move into
the worker if it becomes slow.

## Interfaces and documentation

- Every export of a public entry has TSDoc. It says what the export is in the plan's terms; for a port, it also says
  what every implementation guarantees (atomicity, ordering, what `null` and `conflict` mean).
- Every project has a `README.md`: its job in one paragraph, its entries, what it may and never imports, how it is
  tested, and which data files it owns, if any.
- Contracts (`auth-contract`, `docs-contract`, later `plan-api`) carry a version constant and a `CHANGELOG.md`.
- Ports and contracts use `readonly` inputs, branded ids and `Result` failures. Library types (Better Auth, MCP
  SDK, HiGHS) never cross a public entry outside their adapter.
- `docs/architecture.md` and `CLAUDE.md` are updated at the end of each phase.

## Enforcement

- pnpm dependencies per package, as now.
- Oxlint overrides for the new tags and for which `plan-domain` entry may import which.
- Steiger for every module, `sign-in` included.
- **A graph check** (`scripts/check-graph.ts`, run by `pnpm run check`): it reads the Nx project graph and fails
  when a project depends on a tag it may not, standing in for the Nx boundary plugin that cannot run on
  TypeScript 7.

## Build order

1. **Seams, no visible change.**
   1. `plan-domain` entries; core cut from other areas; fixtures independent of the courses.
   2. `plan-content` extracted.
   3. `plan-service` with ports, use cases, failures, access rule and testing kit.
   4. `plan-data` as async adapters with the directory injected, passing the contract suites.
   5. Web server functions and `/api/*` routes as thin adapters; one failure mapping; the actor is the local owner.
   6. `apps/mcp`.
   7. `PlannerPage` grouped interfaces; `PlanView` replaces both read models.
   8. `docs-host` becomes `remote-host`.
   9. READMEs, TSDoc, the graph check, the architecture doc.

   Done when the app behaves exactly as before; `pnpm run plan`, `check`, `test` and `build` pass; the graph check
   passes; no `node:*` import outside `plan-data`, `auth-server`, `plan-content` scripts and apps.
2. **Accounts and the sign-in micro.** `AUTH_MODE`; `auth-contract`, `auth-server`, `modules/sign-in`,
   `apps/auth`; the shell's account button and sign-in host; the actor from the session; one plan per person; feed
   tokens; API keys for the MCP server; the SMTP and dev mailers; account deletion; integrations for the owner only.
   Done when, in accounts mode, a new person can sign up, verify, sign in with a password, Google or Microsoft,
   reset a password and delete their account; a signed-out call opens the drawer and carries on; one person never
   reads another's plan or feeds. In local mode, nothing has changed from phase 1.
3. **Calendars through the sign-in.** As above.
4. **Parts that run alone.** As above.

## Calls made (for review)

- Approach 1 over finer packages or services now.
- `plan-domain` gets entries, not packages; the folder-or-package test above decides later splits.
- The owner's courses and their generator leave the domain for `plan-content`.
- The Google, Outlook, HiGHS and iCal adapters are entries of `plan-data`, not packages.
- Focus and timeline stay in the planner; the integrations UI leaves it in phase 3, when it is rewritten.
- `docs-host` is generalized into `remote-host`; no separate `auth-host`, since the web shell is the only host.
- Sign-in UI is a build-time module packaged as a remote by `apps/auth`, with the bundled copy as the fallback.
- Better Auth for accounts, behind `auth-server`; SQLite for accounts until phase 4.
- Two modes: `local` (no accounts, today's behaviour, the default) and `accounts` (a hosted copy). They keep
  separate data; plans move between them as plan files.
- One plan per person, chosen by the server; no plan ids in URLs; only the host's configured plan is public.
- A new person starts with one empty plan; templates from `plan-content` come later.
- Calendar feeds of a private plan use a secret, renewable token in the address; local mode keeps today's addresses.
- Until phase 3, only the owner's account gets calendar-app integrations on a hosted copy.
- The MCP server acts for the local owner in local mode, through an API key in accounts mode.
- Deleting an account removes everything at once after a fresh sign-in; the owner's account cannot be deleted from
  the app.
- Mail goes through SMTP in accounts mode; the provider is chosen when deploying.
- Failures are returned values, mapped once per transport; a conflicting save is retried once.

## Left to the builder

- Exact names of ports, services, entries and the grouped `PlannerPage` interfaces.
- Which file goes into which `plan-domain` entry, within the import rules above.
- The fs layout for plans other than `default`.
- How server functions get the actor (TanStack Start middleware is the expected route) and how the client retries
  after sign-in.
- Where the popup completion page is served from, as long as it is on the app's origin.
- The Better Auth version to pin and its schema migration command.
- Mail templates and their wording in ru, en and es.

## Risks

- **Going async touches every caller of `plan-data`**: server functions, the MCP server, the sync engine, scripts and
  tests. Phase 1 does it in one pass per caller, behind the contract suites.
- **Domain tests built on `buildPlan()`** need fixtures before `plan-content` can move.
- **Better Auth details** (API key plugin, linking a provider with more scopes, refreshing a linked account's token,
  encrypted tokens, `node:sqlite` with the pinned version) were checked against its documentation, not run. Confirm
  them with a spike at the start of phase 2.
- **Google's verification** takes weeks and gates phase 3 for everyone outside the test list.
- **A JSON store for many people** is fine on one host with few people; `plan-data/sql` in phase 4 is the way out.
- **Paths change**: `.mcp.json`, `CLAUDE.md`, `.gitignore` and the docs chapters that cite `plan-data` files.
  `apps/docs` checks its citations (`pnpm --filter @lc/docs test`), so a moved file shows up there.
