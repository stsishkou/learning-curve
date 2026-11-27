# Phase 1: seams, no visible change — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every operation on the plan behind one application layer with async ports, so storage and outside
services are swappable, without changing anything a person sees.

**Architecture:** `@lc/plan-domain` is regrouped into folders with one public entry each and loses the owner's
courses to a new `@lc/plan-content`. A new `@lc/plan-service` owns the ports (interfaces) and the use cases and
returns failures as values. `@lc/plan-data` becomes the Node adapters for those ports, one entry each, plus a
`./local` entry that wires them. `apps/web` server functions, `/api/*` routes and a new `apps/mcp` only parse,
call one use case with the actor and map the result. The planner takes the shared `PlanView` and grouped props.
`@lc/docs-host` becomes the generic `@lc/remote-host`.

**Tech Stack:** TypeScript 7 (strict, no compiler API), Nx 24, pnpm 12 workspaces, Vitest 5, Oxlint 1.94, Steiger,
TanStack Start 1.169, React 19, `@modelcontextprotocol/sdk` 1.32, HiGHS, ical.js, Module Federation runtime 2.9.

**Spec:** `docs/superpowers/specs/2026-11-27-parts-interfaces-and-sign-in-design.md` (phase 1 of its build order).

## Global Constraints

- No visible change: every page, every `/api/*` response, the MCP tools and `pnpm run plan` behave as before. The
  only intended differences: an `apply_update` through MCP now also sends the change to connected calendar apps,
  as the web app always did; a library call on an unknown file answers "Not found".
- Project rules from `CLAUDE.md` hold: no `any`, `as` or `!`; `noUncheckedIndexedAccess`;
  `exactOptionalPropertyTypes` (optional props callers may pass `undefined` to are `name?: T | undefined`);
  `void work()` for a promise started on purpose; imports inside a package are relative, other packages by name
  through a public entry; no path aliases in `modules/*` or `packages/*`; shared versions from the `catalog`.
- Function-typed members of interfaces are properties (`change: (c: PlanChange) => Promise<void>`), not method
  shorthand: `typescript/unbound-method` is on.
- Every export of a public entry gets TSDoc saying what it is in the plan's terms; a port's TSDoc also says what
  every implementation guarantees. A comment only says why, never what the code says.
- Never stage `packages/plan-data/data/*.json`: the owner has uncommitted edits there. `pnpm run plan` may rewrite
  `plan.json` from the owner's `edits.json`; that is expected and stays uncommitted.
- Commits: Conventional Commits, body lines ≤ 100 chars, on `develop`, no push. One commit per task at least.
- The dev server runs on :3000 throughout. Restart it (stop the `vite dev --port 3000` process, then
  `pnpm run dev` in the background) after any task that moves files or packages, and leave it running at the end.
- Run `pnpm install` after any `package.json` change.
- Every task ends green (`check` and `test` for what it touches). So the old `plan-data` code (`store.ts`,
  `library.ts`, `bundled.ts`, `calendar-sync/`, the kits, `rebalance.ts`, `src/index.ts` and its `"."` export) stays
  in place, unchanged except for import paths, until Task 10 removes its last user, the old MCP script. New code is
  written beside it, adapted from it; the old copies are deleted in Task 10.
- The domain fixtures stop depending on the courses by freezing today's generated plan into a JSON file, not by
  inventing a smaller plan (a deviation from the spec's wording with the same effect: editing a course no longer
  touches the fixtures, and every existing test keeps its data).
- Layer rule (spec, with one recorded deviation): app → anything below; module → domain, contract, shared;
  infra → service, domain, content, contract; service → domain; content → domain; domain, contract → nothing;
  shared → contract only (`remote-host/docs` needs `docs-contract`).
- Inside `plan-domain`: `core` imports nothing outside `core`; `insights` → core; `protocol` → core, insights
  (deviation from the spec's table: `guide.ts` reports accuracy); `ics` → core; `sync` → core, protocol, ics;
  `rebalance` → core; `fixtures` → anything in the package.
- Ids: `PlanId` and `UserId` are branded strings matching `/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/`, made only by
  `isPlanId`/`isUserId` guards or `parsePlanId`/`parseUserId`. `LOCAL_OWNER` is `'local'`, `DEFAULT_PLAN` is
  `'default'`.
- Failure → transport: `signed-out` 401, `forbidden` 403, `not-found` 404, `conflict` 409, `invalid` 422.
  `failureMessage(forbidden)` is exactly `The plan is read-only here` (today's text).

## Review Focus

1. **Two writers at once** (two tabs, the MCP server and the page, `pnpm run plan` while the app runs): a save that
   meets a moved revision is retried once on a fresh read; only a second conflict is reported. Test in Task 6.
2. **Read-only host** (`PLAN_READONLY=1`, or a data directory that cannot be written): every write answers
   `forbidden` with `The plan is read-only here`, `revision` answers null, the busy address cannot be set. Tests in
   Tasks 6 and 7.
3. **An update whose second change does not fit**: nothing is stored, and the failure names index 1. Test in Task 6.
4. **`edits.json` changed by hand or by `git pull`**, so the stored history no longer matches the edits: the
   history starts again from the current edits instead of undoing into a plan that never existed. Test in Task 6.
5. **A host with no data directory** (only the bundled `plan.json`): the plan reads as the bundled one with no
   edits and no history, and nothing can be written. Test in Task 7.

---

### Task 0: Baseline

**Files:** none in the repository; outputs in the session scratchpad.

- [ ] **Step 1: Record what must not change.** With the dev server up, save the responses of `GET /api/plan`,
  `/api/plan-guide`, `/api/plan-guide?brief=1`, `/api/plan-accuracy`, `/api/plan-schema` and `/api/ics/all` to
  `<scratchpad>/baseline/`, and copy `packages/plan-data/data/plan.json` there as `plan.before.json`.
- [ ] **Step 2: Confirm the starting point is green.** Run `pnpm run check && pnpm run test`. Expected: PASS. If
  it fails, stop and report: the plan assumes a green start.

---

### Task 1: Cut `plan-domain`'s core loose from the other areas

**Files:**
- Create: `packages/plan-domain/src/ids.ts`, `view.ts`, `provider.ts`, `feed-address.ts`, `weekly-hours.ts`, and
  `ids.test.ts`, `feed-address.test.ts`
- Modify: `packages/plan-domain/src/types.ts` (gains `SessionMove`), `replan.ts` (imports it), `changes.ts`,
  `history.ts`, `calendar-sync.ts` (provider re-imported from `provider.ts`), `schedule.ts` (loses `weeklyHours`),
  `course-plan.ts`, `free-slot.ts`, `update.ts`, `guide.ts`, `rebalance/*.ts` (import `weeklyHours`, `SessionMove`
  from their new homes), `index.ts`
- Modify: `packages/plan-data/src/busy.ts` (drops `feedAddress`), `apps/web/src/server/busy.ts` (imports it from
  the domain)

**Interfaces:**
- Produces (all from `@lc/plan-domain`):
  - `type PlanId`, `type UserId` (branded), `isPlanId(value: string): value is PlanId`,
    `isUserId(value: string): value is UserId`, `parsePlanId(value: unknown): PlanId`,
    `parseUserId(value: unknown): UserId` (throw `Error('Not a plan id')` / `Error('Not a user id')`)
  - `type PlanAccess = 'owner' | 'reader'`; `interface PlanView { readonly id: PlanId; readonly plan: Plan;
    readonly access: PlanAccess; readonly edited: readonly string[]; readonly trash: PlanTrash;
    readonly history: HistoryView }` (no `name`: the plan's title is in `plan.meta`)
  - `CALENDAR_PROVIDERS`, `type CalendarProvider`, `isCalendarProvider` (moved, same names)
  - `feedAddress(input: string): string | null` (moved unchanged from `plan-data/src/busy.ts`)
  - `weeklyHours(plan: Plan): Record<string, number>` (moved unchanged), `SessionMove` (moved unchanged)

- [ ] **Step 1: Write the failing tests.**

```ts
// ids.test.ts
test('a plan id is a short name of letters, digits, _ and -', () => {
  expect(isPlanId('default')).toBe(true)
  expect(isPlanId('plan-1a2b')).toBe(true)
  for (const bad of ['', '-x', '../x', 'a/b', 'x'.repeat(65)]) expect(isPlanId(bad)).toBe(false)
  expect(parsePlanId('default')).toBe('default')
  expect(() => parsePlanId(42)).toThrow('Not a plan id')
})
// feed-address.test.ts
test('webcal is https, anything else is refused', () => {
  expect(feedAddress(' webcal://example.com/a.ics ')).toBe('https://example.com/a.ics')
  expect(feedAddress('http://example.com/a.ics')).toBeNull()
  expect(feedAddress('not a url')).toBeNull()
})
```

- [ ] **Step 2: Run them.** `pnpm exec nx run @lc/plan-domain:test`. Expected: FAIL, modules not found.
- [ ] **Step 3: Create the files and move the pieces.** `changes.ts` keeps `weekReview` from `goals.ts`, which
  moves to core in Task 2 as a whole file (it depends on core only); here only the provider, `SessionMove`,
  `weeklyHours` and `feedAddress` move. Export the new names from `index.ts`.
- [ ] **Step 4: Run.** `pnpm exec nx run-many -t typecheck lint test -p @lc/plan-domain @lc/plan-data @lc/web`.
  Expected: PASS.
- [ ] **Step 5: Commit.** `refactor(plan-domain): give ids, the plan view and shared pieces a home in the core`

---

### Task 2: One folder and one public entry per area of `plan-domain`

**Files:**
- Move (`git mv`) into `packages/plan-domain/src/core/`: `types`, `ids`, `view`, `dates`, `recurrence`,
  `occurrences`, `occurrence-changes`, `edits`, `changes`, `history`, `trash`, `labels`, `progress`, `accuracy`,
  `goals`, `deadlines`, `rules`, `diff`, `revisions`, `free-slot`, `quick-event`, `course-plan`, `library`, `busy`,
  `weekly-hours`, `provider`, `feed-address`, `schedule`, `content` (the last two leave in Task 3), with their tests
- Move into `src/insights/`: `accuracy-report`, `forecast`, `replan`, `stats`, `streak`, `reviews`, `lanes`
- Move into `src/protocol/`: `update`, `schema`, `guide`; into `src/ics/`: `ics`; into `src/sync/`:
  `calendar-sync`, `google-sync`, `outlook-sync`; `src/rebalance/index.ts` → `src/rebalance/plan.ts`;
  `src/fixtures.ts` → `src/fixtures/index.ts`
- Create: an `index.ts` per folder (the entry), replacing `src/index.ts`
- Modify: `packages/plan-domain/package.json` (`exports`), `.oxlintrc.json` (one override per folder), every
  importer of `@lc/plan-domain` in `modules/*`, `apps/*`, `packages/*`

**Interfaces:**
- Produces: entries `@lc/plan-domain` (core), `@lc/plan-domain/insights`, `/protocol`, `/ics`, `/sync`,
  `/rebalance`, `/fixtures`; every name keeps its spelling, only its entry changes.

- [ ] **Step 1: Move the files and write the entries.** `package.json` `exports`: `"."` → `./src/core/index.ts`,
  `"./insights"`, `"./protocol"`, `"./ics"`, `"./sync"`, `"./rebalance"`, `"./fixtures"` → their folder's
  `index.ts`.
- [ ] **Step 2: Add the folder rules to `.oxlintrc.json`.** For `packages/plan-domain/src/core/**` forbid
  `../insights`, `../insights/**`, `../protocol/**`, `../ics/**`, `../sync/**`, `../rebalance/**`,
  `../fixtures/**`; for `insights/**` forbid all but `../core/**`; for `protocol/**` all but core and insights;
  `ics/**` all but core; `sync/**` all but core, protocol, ics; `rebalance/**` all but core. Each override repeats
  the package's existing patterns (no `@lc/*`, React or `node:*`), since an override replaces the rule's options.
- [ ] **Step 3: Point every importer at the right entry.** Let `pnpm run typecheck` list them.
- [ ] **Step 4: Prove a forbidden import fails.** Add `import { planGuide } from '../protocol'` to
  `core/changes.ts`, run `pnpm exec nx run @lc/plan-domain:lint`: Expected FAIL naming the rule. Remove it.
- [ ] **Step 5: Run everything.** `pnpm run check && pnpm run test`. Expected: PASS. Restart the dev server and
  load `/`, `/timeline`, `/focus`, `/dashboard`: they render.
- [ ] **Step 6: Commit.** `refactor(plan-domain): one folder and one public entry per area`

---

### Task 3: The owner's courses move to `@lc/plan-content`

**Files:**
- Create: `packages/plan-domain/src/fixtures/base-plan.json` (generated once, below), `packages/plan-content/`
  (`package.json`, `tsconfig.json`, `README.md`, `src/index.ts`, `src/schedule.test.ts`)
- Move: `packages/plan-domain/src/core/content.ts` and `core/schedule.ts` → `packages/plan-content/src/`
- Modify: `packages/plan-domain/src/fixtures/index.ts`, the domain tests that call `buildPlan`
  (`accuracy-report`, `accuracy`, `changes`, `forecast`, `history`, `replan`, `schema`),
  `modules/planner/src/widgets/course-progress/ui/CourseProgress.stories.tsx`, `packages/plan-data` (`store.ts`,
  `rebalance.test.ts`, `package.json`), `apps/web/src/server/plan.ts`, `.oxlintrc.json`, root `package.json`
  (`test` project list)

**Interfaces:**
- Produces: `@lc/plan-content` exporting `buildPlan(config?: ScheduleConfig, generated?: string): Plan`,
  `DEFAULT_CONFIG: ScheduleConfig`, `type ScheduleConfig` (unchanged signatures); `@lc/plan-domain/fixtures`
  gains `fixtureBase: Plan` (the frozen generated plan) and keeps every export it has.

- [ ] **Step 1: Freeze the fixture before moving anything.** Write `buildPlan(DEFAULT_CONFIG, '2026-11-22')` as
  JSON (two-space indent, trailing newline) to `src/fixtures/base-plan.json` with a one-off `pnpm exec tsx -e …`.
  `fixtures/index.ts` reads it and narrows it with `isPlan`, throwing as `bundled.ts` does when it is not a plan.
- [ ] **Step 2: Switch fixtures and domain tests to `fixtureBase`.** Run `pnpm exec nx run @lc/plan-domain:test`.
  Expected: PASS with the same test count as before.
- [ ] **Step 3: Create `@lc/plan-content`.** Tags `type:content`, `scope:plan`; depends on `@lc/plan-domain`;
  Oxlint override: may import `@lc/plan-domain` only, no React, no `node:*`. The README's job line: "The owner's
  courses and the generator built for them. Edit courses here, then `pnpm run plan`."
- [ ] **Step 4: Write the content test.**

```ts
test('the generated plan is a plan and every event is in one of its calendars', () => {
  const plan = buildPlan(DEFAULT_CONFIG, '2026-11-22')
  expect(isPlan(plan)).toBe(true)
  const calendars = new Set(plan.calendars.map((c) => c.id))
  expect(plan.events.every((e) => calendars.has(e.calendar))).toBe(true)
})
```

- [ ] **Step 5: Move `content.ts` and `schedule.ts`; repoint `plan-data`, the web server and the story.** The
  story uses `fixtureBase`. Add `@lc/plan-content` to the root `test` script's project list.
- [ ] **Step 6: Verify.** `pnpm run check && pnpm run test && pnpm run plan`, then
  `diff <scratchpad>/baseline/plan.before.json packages/plan-data/data/plan.json`. Expected: no difference.
  `pnpm install`, restart the dev server, and load `/`: it renders.
- [ ] **Step 7: Verify the graph win.** `pnpm exec nx show projects --affected --files=packages/plan-content/src/content.ts`.
  Expected: `@lc/plan-content`, `@lc/plan-data`, `@lc/web` and nothing from `modules/*` or `@lc/stand`.
- [ ] **Step 8: Commit.** `refactor: move the owner's courses out of the domain into plan-content`

---

### Task 4: `@lc/plan-service` — results, failures, the actor, the access rule and the ports

**Files:**
- Create: `packages/plan-service/` with `package.json` (tags `type:service`, `scope:plan`; depends on
  `@lc/plan-domain`; dev `vitest`), `tsconfig.json` (`types: []`), `README.md`, `src/index.ts`, `src/result.ts`,
  `src/failure.ts`, `src/actor.ts`, `src/access.ts`, `src/access.test.ts`, `src/ports/{plans,library,sync-state,
  settings,busy,calendar,clock,host,index}.ts`
- Move: `packages/plan-data/src/queue.ts` (+ test) → `packages/plan-service/src/queue.ts`; the old
  `plan-data/src/rebalance.ts` imports `newestOnly` from `@lc/plan-service` (add the dependency)
- Modify: `.oxlintrc.json` (service may import `@lc/plan-domain` and its entries only; no React, no `node:*`;
  `plan-data` may now import `@lc/plan-service` too), root `package.json` (`test` list)

**Interfaces:**
- Produces:
  - `type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }`,
    `ok<T>(value: T)`, `fail<E>(error: E)`
  - `type PlanFailure` exactly as in the spec (`signed-out`, `forbidden`, `not-found`, `conflict`,
    `invalid { index, message }`); `failureMessage(failure: PlanFailure): string`
  - `type Actor` (spec), `LOCAL_OWNER: UserId`, `LOCAL_ACTOR: Actor`, `DEFAULT_PLAN: PlanId`
  - `interface HostRules { readonly writable: () => boolean; readonly publicPlan: PlanId | null }`
  - `accessOf(actor: Actor, plan: { readonly id: PlanId; readonly owner: UserId }, host: HostRules):
    Result<PlanAccess, PlanFailure>`; `mustOwn(access: PlanAccess): Result<void, PlanFailure>`
  - Ports (all members async, TSDoc with guarantees):
    - `PlanRepository { get(id): Promise<StoredPlan | null>; listOwned(owner): Promise<readonly PlanSummary[]>;
      revision(id): Promise<Revision | null>; save(id, next: PlanWrite, expected: Revision):
      Promise<Revision | 'conflict'> }`; `StoredPlan { id, owner, base, edits, history, plan, revision }`
      (`plan` = `base` with `edits` applied, as last written); `PlanWrite { edits, history, plan }`;
      `PlanSummary { id, title }`; `type Revision = string`. `revision` is null where the store cannot be written.
    - `PlanLibrary { list(owner): Promise<readonly StoredPlanFile[]>; get(owner, id): Promise<StoredPlanFile |
      null>; put(owner, file: StoredPlanFile): Promise<void>; remove(owner, id): Promise<void> }`
    - `SyncStateStore { feedRevisions(plan): Promise<Revisions>; saveFeedRevisions(plan, r): Promise<void>;
      calendarSync(plan, provider): Promise<CalendarSync>; saveCalendarSync(plan, provider, s): Promise<void> }`
    - `PrivateSettings { busyFeed(owner): Promise<BusyFeedSetting>; setBusyFeed(owner, url: string | null):
      Promise<void> }`; `BusyFeedSetting { readonly url: string | null; readonly fixed: boolean }`
    - `BusyFeedReader { read(url, from: number, to: number, fresh?: boolean): Promise<readonly BusyBlock[]> }`
    - `CalendarConnector { provider; auth: OAuthConfig; adapter: (token, timeZone) => CalendarAdapter;
      problemOf: (err: unknown) => CalendarProblem | null; idOf?: ((uid: string) => string) | undefined }`;
      `CalendarAdapter`, `Saved` and `OAuthConfig` defined from `plan-data/src/calendar-sync/kit.ts`
      (`OAuthConfig` without `env`); `CalendarProblem` from `engine.ts`; `class CalendarAuthError` from `oauth.ts`.
      The old definitions stay where they are until Task 10.
    - `CalendarSignIn { status(provider): Promise<{ configured: boolean; connectedAt: number | null }>;
      saveClient(provider, id, secret): Promise<void>; connectAddress(provider, redirect): Promise<string>;
      finishConnect(provider, code, state): Promise<void>; disconnect(provider): Promise<void> }` (one account per
      host until phase 3; TSDoc says so)
    - `CalendarTokens { token(owner: UserId, provider, renew: boolean): Promise<string> }`
    - `Clock { now: () => number }` (real ms; the Minsk clock is `toMinsk(clock.now())`)
    - `PlanPorts { plans, library, syncState, settings, busy, solve: Solve, connectors: Readonly<Record<
      CalendarProvider, CalendarConnector>>, calendarSignIn, calendarTokens, clock, host: HostRules }`
  - `newestOnly`, `Superseded` (moved, unchanged)

- [ ] **Step 1: Write the failing access test.**

```ts
const host = (writable: boolean, publicPlan: PlanId | null = null): HostRules => ({ writable: () => writable, publicPlan })
const mine = { id: DEFAULT_PLAN, owner: LOCAL_OWNER }
const someone: Actor = { kind: 'person', userId: parseUserId('someone') }
const nobody: Actor = { kind: 'anonymous' }

test.each([
  ['the owner on a writable host', LOCAL_ACTOR, host(true), ok('owner')],
  ['the owner on a read-only host', LOCAL_ACTOR, host(false), ok('reader')],
  ['someone else, public plan', someone, host(true, DEFAULT_PLAN), ok('reader')],
  ['someone else, private plan', someone, host(true), fail({ kind: 'not-found' })],
  ['signed out, public plan', nobody, host(true, DEFAULT_PLAN), ok('reader')],
  ['signed out, private plan', nobody, host(true), fail({ kind: 'signed-out' })],
])('%s', (_, actor, rules, expected) => expect(accessOf(actor, mine, rules)).toEqual(expected))

test('a reader may not write', () => {
  expect(mustOwn('reader')).toEqual(fail({ kind: 'forbidden' }))
  expect(failureMessage({ kind: 'forbidden' })).toBe('The plan is read-only here')
})
```

- [ ] **Step 2: Run it.** `pnpm exec nx run @lc/plan-service:test`. Expected: FAIL, module not found.
- [ ] **Step 3: Write the package, the types, `accessOf` and `mustOwn`; move the queue.**
- [ ] **Step 4: Run.** `pnpm install && pnpm exec nx run-many -t typecheck lint test -p @lc/plan-service
  @lc/plan-data`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(plan-service): the application layer's results, actor, access rule and ports`

---

### Task 5: The testing kit — in-memory adapters and one contract suite per port

**Files:**
- Create: `packages/plan-service/src/testing/{index,memory,contracts/plans,contracts/library,
  contracts/sync-state,contracts/settings}.ts`, `src/testing/memory.test.ts`
- Modify: `packages/plan-service/package.json` (`"./testing"` export; `vitest` also as an optional peer, since the
  suites import it)

**Interfaces:**
- Consumes: the ports of Task 4.
- Produces (from `@lc/plan-service/testing`):
  - `createMemoryPorts(options?: { base?: Plan; owner?: UserId; writable?: boolean; busy?: readonly BusyBlock[];
    busyFeed?: BusyFeedSetting; solve?: Solve; now?: number }): MemoryPorts`, where `MemoryPorts` is
    `PlanPorts & { conflictsLeft: number }` (a count of `save` calls that will answer `conflict` first, for tests).
    Default base: `fixtureBase`; the store holds `DEFAULT_PLAN` owned by `LOCAL_OWNER` with no edits and no
    history. Connectors, sign-in and tokens reject with `Error('No calendar apps in memory')`.
  - `describePlanRepository(name: string, make: () => Promise<{ repo: PlanRepository; seeded: PlanId;
    owner: UserId }>): void`, and `describePlanLibrary`, `describeSyncStateStore`, `describePrivateSettings` in
    the same shape.

- [ ] **Step 1: Write the contract suites.** Each is a `describe(name, …)` with these tests:
  - repository: `get` returns the seeded plan and null for an unknown id; `listOwned` finds it for its owner and
    nothing for another; `save` with the read revision stores `edits`, `history` and `plan` and returns a new
    revision that `revision()` and the next `get` report; `save` with a stale revision answers `'conflict'` and
    `get` still shows the earlier write.
  - library: `put` then `get` round-trips a `StoredPlanFile`; `list` holds every file put; `remove` drops one;
    another owner sees none of them.
  - sync state: unread state is empty (`parseRevisions(null)`, `parseCalendarSync(null)`); a saved value reads
    back per provider; another plan id stays empty.
  - settings: no address at first (`{ url: null, fixed: false }`); a set address reads back; setting `null`
    forgets it; another owner has none.
- [ ] **Step 2: Run the suites against the memory adapters** in `memory.test.ts`. Expected: FAIL until
  `memory.ts` exists, then PASS.
- [ ] **Step 3: Commit.** `test(plan-service): in-memory adapters and a contract suite per port`

---

### Task 6: The plan, library, busy and re-balance use cases, and the input parsers

**Files:**
- Create: `packages/plan-service/src/services/{create,plans,library,busy,rebalance}.ts` and a `.test.ts` beside
  each of `plans`, `library`, `busy`, `rebalance`; `src/parse.ts`, `src/parse.test.ts`

**Interfaces:**
- Consumes: Tasks 4–5.
- Produces:
  - `createPlanServices(ports: PlanPorts): PlanServices`; `PlanServices { plans: PlanService; library:
    LibraryService; busy: BusyService; rebalance: RebalanceService; calendars: CalendarSyncService }`
    (`calendars` arrives in Task 8; until then the factory has no `calendars` member).
  - `PlanService` — every method resolves the actor's plan itself (a person: their first owned plan; signed out:
    `host.publicPlan`), so no plan id crosses this interface:
    - `view(actor): Promise<Result<PlanView, PlanFailure>>`
    - `read(actor): Promise<Result<Plan, PlanFailure>>` (the plan only; adapters may apply pure domain read
      functions such as `planGuide`, `accuracyReport` or `calendarICS` to it)
    - `revision(actor): Promise<Result<Revision | null, PlanFailure>>` (null on a read-only host)
    - `apply(actor, changes: readonly PlanChange[], source?: StepSource): Promise<Result<PlanView, PlanFailure>>`
    - `preview(actor, changes: readonly PlanChange[]): Promise<Result<UpdatePreview, PlanFailure>>`
    - `travel(actor, cursor: number): Promise<Result<PlanView, PlanFailure>>`
    - `trimHistory(actor): Promise<Result<PlanView, PlanFailure>>`
    - `rebuild(actor): Promise<Result<{ view: PlanView; orphans: readonly string[] }, PlanFailure>>`
      (regenerates from the stored base, purges the trash, keeps the history; what `pnpm run plan` runs)
    - `feed(actor): Promise<Result<{ plan: Plan; revisions: Revisions }, PlanFailure>>` (brings the stored feed
      revisions up to the plan when the host is writable, as `feedRevisions` does today)
  - `LibraryService { list(actor); read(actor, id, version?): Result<Plan>; save(actor, input: PlanFileSave):
    Result<PlanFileInfo>; rename(actor, id, name): Result<PlanFileInfo>; remove(actor, id, version?):
    Result<readonly PlanFileInfo[]> }` (all async; list sorted saved-last-first; new ids
    `plan-<base36 time><3 random chars>`; rename trims and caps at 80 characters, keeping the old name when empty —
    today's rules from `library.ts`)
  - `BusyService { feed(actor): Result<BusyFeed>; setFeed(actor, url: string | null): Result<BusyFeed>;
    blocks(actor, from, to): Result<readonly BusyBlock[]> }` (async; `BusyFeed { host: string | null; canSet:
    boolean }` moved from `apps/web/src/server/busy.ts`; `setFeed` reads the address once with `fresh` before
    keeping it)
  - `RebalanceService { rebalance(actor, plan: Plan, request: RebalanceRequest): Promise<Result<RebalanceResult,
    PlanFailure>> }` (one at a time with `newestOnly`; a dropped request rejects with `Superseded`; busy time
    from the actor's address over 367 days, empty when it does not answer)
  - `apply` and `travel` call an internal `afterSave(actor)` hook; Task 8 points it at
    `calendars.syncAll(actor)`. The sync service's own saves do not call it.
  - Parsers (throw `Error` with today's messages): `parseChanges(input): PlanChange[]` ("Changes are required"),
    `parseCursor(input): number` ("A step is required"), `parseBusyWindow(input): { from: number; to: number }`
    (≤ 62 days; "A window of at most two months is required"), `parseBusyAddress(input): string | null` ("An https
    or webcal address of an iCal file is required"), `parseFileRef`, `parseFileSave`, `parseFileRename`,
    `parseRebalanceInput(input): { plan: Plan; request: RebalanceRequest }` — each moved from the validator it
    replaces in `apps/web/src/server/*.ts`.

- [ ] **Step 1: Write the failing use-case tests** (memory ports; a few as code, the rest named):

```ts
test('an update whose second change does not fit stores nothing and names it', async () => {
  const ports = createMemoryPorts()
  const { plans } = createPlanServices(ports)
  const before = await ports.plans.get(DEFAULT_PLAN)
  const result = await plans.apply(LOCAL_ACTOR, [
    { type: 'plan.rename', title: 'Fine' },
    { type: 'event.remove', uid: 'no-such-event' },
  ])
  expect(result).toMatchObject({ ok: false, error: { kind: 'invalid', index: 1 } })
  expect(await ports.plans.get(DEFAULT_PLAN)).toEqual(before)
})

test('a save that meets another writer is tried again once on fresh data', async () => {
  const ports = createMemoryPorts()
  ports.conflictsLeft = 1
  const result = await createPlanServices(ports).plans.apply(LOCAL_ACTOR, [{ type: 'plan.rename', title: 'X' }])
  expect(result.ok).toBe(true)
  ports.conflictsLeft = 2
  const again = await createPlanServices(ports).plans.apply(LOCAL_ACTOR, [{ type: 'plan.rename', title: 'Y' }])
  expect(again).toEqual(fail({ kind: 'conflict' }))
})

const storedPlan = async (ports: PlanPorts) => {
  const stored = await ports.plans.get(DEFAULT_PLAN)
  if (!stored) throw new Error('No default plan')
  return stored
}

test('edits changed outside the history start the history again', async () => {
  const ports = createMemoryPorts()
  const { plans } = createPlanServices(ports)
  await plans.apply(LOCAL_ACTOR, [{ type: 'plan.rename', title: 'Renamed' }])
  const stored = await storedPlan(ports)
  // As `git pull` would leave it: other edits beside the same history.
  await ports.plans.save(DEFAULT_PLAN, { edits: emptyEdits(), history: stored.history, plan: stored.base }, stored.revision)
  expect(await plans.view(LOCAL_ACTOR)).toMatchObject({ ok: true, value: { history: { steps: [], cursor: 0 } } })
  expect(await plans.travel(LOCAL_ACTOR, 0)).toMatchObject({ ok: true })
  expect((await storedPlan(ports)).edits).toEqual(emptyEdits())
})
```

  Named tests, each asserting the obvious result: `view shows the plan, its edited uids, its trash and its
  history`; `on a read-only host every write is forbidden and the revision is null` (apply, travel, trimHistory,
  library save/rename/remove, busy setFeed; message `The plan is read-only here`); `travel to 0 undoes every step
  and travel back redoes them`; `trimHistory keeps the first and the current step`; `rebuild keeps the history and
  reports edits for events that no longer exist`; `feed revisions move when an event changes`;
  `library lists the last saved first, names new files plan-…, and answers not-found for an unknown file`;
  `busy cannot be set when the host fixes the address`; `rebalance uses the actor's busy time`; and parser tests
  with today's messages.
- [ ] **Step 2: Run them.** `pnpm exec nx run @lc/plan-service:test`. Expected: FAIL.
- [ ] **Step 3: Implement.** `apply` is today's `saveChanges` (`packages/plan-data/src/store.ts`) on the stored
  plan: purge the trash first, record each change as a history step, apply the edits to the base for `plan`, save
  with the read revision, retry once on `conflict`. A thrown `PlanChangeError` (or any error from `applyChange`)
  becomes `invalid` with the change's index. `view` is today's `state()` (`apps/web/src/server/plan.ts`) with
  `access` from `accessOf`. The history is `inSync(history, edits) ? history : emptyHistory(edits)` wherever it is
  read.
- [ ] **Step 4: Run.** `pnpm exec nx run-many -t typecheck lint test -p @lc/plan-service`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(plan-service): the plan, library, busy and re-balance use cases`

---

### Task 7: `plan-data/fs` — the JSON files behind the storage ports

**Files:**
- Create: `packages/plan-data/src/fs/{index,plans,library,sync-state,settings,files}.ts`, `src/fs/fs.test.ts`,
  adapted from `src/store.ts`, `src/library.ts` and `src/bundled.ts` (which stay until Task 10)
- Modify: `packages/plan-data/package.json` (tags `type:infra`, `scope:plan`; depends on `@lc/plan-content`;
  `exports` gains `"./fs"`), `.oxlintrc.json` (`plan-data` may import `@lc/plan-domain`, `@lc/plan-domain/*`,
  `@lc/plan-service`, `@lc/plan-service/testing` in tests, `@lc/plan-content`)

**Interfaces:**
- Consumes: Task 4 ports, Task 5 contract suites, `buildPlan` from `@lc/plan-content`.
- Produces (from `@lc/plan-data/fs`):
  - `findDataDir(cwd: string, env: Readonly<Record<string, string | undefined>>): string` (today's `dataDir`:
    `PLAN_DATA_DIR`, else the nearest `packages/plan-data/data` upwards)
  - `createFsPorts(options: FsOptions): FsPorts` with `FsOptions { dir: string; busyFeedFromHost: string | null;
    calendarIds: Partial<Record<CalendarProvider, (uid: string) => string>> }` and `FsPorts { plans:
    PlanRepository; library: PlanLibrary; syncState: SyncStateStore; settings: PrivateSettings; canWrite:
    () => boolean }`. Nothing is read when the module loads.
  - The repository serves one plan, `DEFAULT_PLAN`, owned by `LOCAL_OWNER`: `base` is `buildPlan()`; `edits`,
    `history`, `plan` are `edits.json`, `history.json`, `plan.json`; the revision is today's `planRevision()`
    (mtime and size of the three files). With no `plan.json` it serves the bundled plan with empty edits and
    history. `save` writes the three files, keeping `plan.meta.generated` when nothing else changed (today's
    `dated`). The library keeps `LOCAL_OWNER`'s files in `library/` and another owner's in
    `people/<id>/library/`. Settings live in `local.json` (mode 0600); `busyFeedFromHost` wins and is `fixed`.
    Sync state lives in `sync.json` (written whole by rename, as today).

- [ ] **Step 1: Write `fs.test.ts`.** Run the four contract suites against `createFsPorts` on a fresh temp
  directory each, plus:

```ts
test('a directory with no plan.json reads as the bundled plan and cannot be written', async () => {
  const ports = createFsPorts({ dir: mkdtempSync(join(tmpdir(), 'lc-empty-')), busyFeedFromHost: null, calendarIds: {} })
  const stored = await ports.plans.get(DEFAULT_PLAN)
  expect(stored?.plan).toEqual(bundledPlan)
  expect(stored?.edits).toEqual(emptyEdits())
  expect(await ports.plans.revision(DEFAULT_PLAN)).toBeNull()
})

test('a save that changes nothing leaves plan.json byte for byte as it was', async () => { /* save twice, compare */ })
test('local.json is readable by its owner only', async () => { /* setBusyFeed, then statSync(...).mode & 0o777 === 0o600 */ })
test('an address set by the host wins and is fixed', async () => { /* busyFeedFromHost: 'https://x/a.ics' */ })
test('two directories do not see each other', async () => { /* write in one, read the other */ })
```

- [ ] **Step 2: Run it.** `pnpm exec nx run @lc/plan-data:test`. Expected: FAIL.
- [ ] **Step 3: Implement**, adapting today's code rather than rewriting it.
- [ ] **Step 4: Run.** `pnpm install && pnpm run check && pnpm run test`. Expected: PASS; the app still runs on
  the old code.
- [ ] **Step 5: Commit.** `refactor(plan-data): the JSON files behind the storage ports`

---

### Task 8: Calendar apps, iCal, HiGHS and the sync service

**Files:**
- Create: `packages/plan-data/src/{ical,highs,google,outlook,local}/index.ts`,
  `packages/plan-data/src/fs/calendar-accounts.ts` (adapted from `calendar-sync/oauth.ts`),
  `packages/plan-service/src/services/calendar-sync/{service,round,proposals,lanes}.ts` (adapted from
  `calendar-sync/engine.ts`)
- Move: `plan-data/src/busy.ts` → `ical/busy.ts` and `solver.ts` (+ test) → `highs/`, with the old `src/index.ts`
  and `rebalance.ts` repointed; `rebalance.test.ts` and `rebalance.example.test.ts` → `highs/` (they test the
  domain with the real solver; `requestFromTool`'s `describe` moves to `apps/mcp` in Task 10). The connectors are
  written beside `google/kit.ts` and `outlook/kit.ts`, over the same `api.ts`; the kits stay for the old engine
  until Task 10.
- Modify: `google/google.test.ts`, `outlook/outlook.test.ts` (rewired to the new path, same scenarios),
  `package.json` (`exports` gains `./ical`, `./highs`, `./google`, `./outlook`, `./local`), `scripts/build-plan.ts`

**Interfaces:**
- Consumes: Tasks 4–7.
- Produces:
  - `@lc/plan-data/ical`: `icalBusyReader: BusyFeedReader` (today's `loadBusy`, keeping its 10-minute reuse),
    `parseBusy`
  - `@lc/plan-data/highs`: `solveLp: Solve`
  - `@lc/plan-data/google`: `googleConnector: CalendarConnector`; `@lc/plan-data/outlook`: `outlookConnector`
  - `createFsPorts` also returns `calendarSignIn: CalendarSignIn` and `calendarTokens: CalendarTokens` (today's
    `oauth.ts`; `FsOptions` gains `connectors` and `clientsFromHost: Partial<Record<CalendarProvider, { id:
    string; secret: string }>>`, which replaces reading `GOOGLE_*`/`OUTLOOK_*` inside the adapter)
  - `@lc/plan-data/local`: `localPorts(options: { dir: string; env: Readonly<Record<string, string |
    undefined>> }): PlanPorts` — fs + iCal + HiGHS + both connectors + `{ now: Date.now }` +
    `host: { writable: () => env.PLAN_READONLY !== '1' && fs.canWrite(), publicPlan: null }`; reads
    `BUSY_ICS_URL` and the providers' client variables from `env`
  - `CalendarSyncService` (in `PlanServices.calendars`): `statuses(actor): Promise<Result<readonly
    CalendarStatus[], PlanFailure>>`, `status(actor, provider)`, `sync(actor, provider)`, `syncAll(actor)`,
    `accept(actor, provider, ids: readonly string[])`, `reject(actor, provider, ids)`, `saveClient(actor, provider,
    id, secret): Result<CalendarStatus>`, `connectAddress(actor, provider, redirect): Result<string>`,
    `finishConnect(actor, provider, code, state): Promise<Result<void, 'denied' | 'scope' | 'client' |
    'failed'>>`, `disconnect(actor, provider): Result<CalendarStatus>`; `CalendarStatus` moved from `engine.ts`
    unchanged. Rounds and decisions still run one at a time; a call while a round waits joins it.
  - `parseProvider(input): CalendarProvider` ("Unknown calendar app"), `parseProposalIds(input)`,
    `parseCalendarClient(input)` added to `src/parse.ts` with today's messages

- [ ] **Step 1: Rewire the Google and Outlook tests first.** Build services from `localPorts({ dir: <temp>, env:
  {} })` with the fake's `fetch` stubbed, and replace each `lib.*` call with the service call. Keep every scenario
  and assertion. Run: Expected FAIL (nothing exists yet).
- [ ] **Step 2: Move the adapters and the engine.** The engine keeps its algorithm; its reads and writes go
  through `plans`, `syncState`, `connectors` and `calendarTokens`. Its own saves use the internal store path,
  which does not call `afterSave`. `createPlanServices` points `afterSave` at `void calendars.syncAll(actor)`.
- [ ] **Step 3: Switch `pnpm run plan`.** `scripts/build-plan.ts` builds services from `localPorts`, calls
  `plans.rebuild(LOCAL_ACTOR)`, and prints the same lines as today.
- [ ] **Step 4: Run.** `pnpm install && pnpm run check && pnpm run test && pnpm run plan && diff
  <scratchpad>/baseline/plan.before.json packages/plan-data/data/plan.json`. Expected: PASS, no difference.
- [ ] **Step 5: Commit.** `refactor: calendar apps, iCal and HiGHS as adapters; the sync rounds in plan-service`

---

### Task 9: The web app as a composition root with thin adapters

**Files:**
- Create: `apps/web/src/server/{services,actor,respond}.ts`
- Modify: every file in `apps/web/src/server/` and `apps/web/src/routes/api/`; `routes/{index,focus,timeline,
  dashboard,__root}.tsx`; `shell/FollowPlan.tsx`; `apps/web/package.json` (adds `@lc/plan-service`)

**Interfaces:**
- Consumes: `createPlanServices`, `localPorts`, `findDataDir`, the parsers, `LOCAL_ACTOR`.
- Produces:
  - `services: PlanServices` (built once from `localPorts({ dir: findDataDir(process.cwd(), process.env), env:
    process.env })`)
  - `actorOf(): Actor` (returns `LOCAL_ACTOR`; phase 2 reads the request)
  - `unwrap<T>(result: Result<T, PlanFailure>): T` (throws `Error(failureMessage(failure))`);
    `respond<T>(result: Result<T, PlanFailure>, ok: (value: T) => Response): Response` (a failure becomes
    `Response.json({ ok: false, problem: { message } }, { status })` with the statuses in Global Constraints)
  - Server functions keep their names except `getPlanState` → `getPlanView`, which returns `PlanView`. Until
    Task 11 the routes hand the modules `{ ...view, canEdit: view.access === 'owner' }`.

- [ ] **Step 1: Rewrite each server function as parse → one service call with `actorOf()` → `unwrap`.** No
  `canWrite`, `mustWrite` or hand-written validator remains in `apps/web`.
- [ ] **Step 2: Rewrite each `/api/*` route the same way with `respond`.** `plan-update` keeps its responses:
  parse error 422, report not ok 422, `?dry` the report, read-only 403, otherwise the stored outcome with
  `applied`. `ics.$calendarId` and `ics-zip` use `plans.feed`/`plans.read` and the `@lc/plan-domain/ics`
  functions. `$provider.connect`/`callback` use `calendars.connectAddress`/`finishConnect`.
- [ ] **Step 3: Verify nothing changed.** `pnpm run check && pnpm run test && pnpm run build`. Restart the dev
  server. Compare each baseline response with the new one (ignore `DTSTAMP` lines in the `.ics`). Expected:
  identical. In the browser: make an edit, undo it, open the history, trim it, open Plan file, open Integrations;
  everything works as before.
- [ ] **Step 4: Commit.** `refactor(web): server functions and routes as thin adapters over plan-service`

---

### Task 10: The MCP server becomes `apps/mcp`

**Files:**
- Create: `apps/mcp/` with `package.json` (`@lc/mcp`; tags `type:app`, `scope:mcp`; scripts `start` (`tsx
  src/main.ts`), `typecheck`, `lint`, `test`; depends on `@lc/plan-data`, `@lc/plan-domain`, `@lc/plan-service`,
  `@modelcontextprotocol/sdk`), `tsconfig.json`, `README.md`, `src/{main,server,tools,rebalance-args}.ts`,
  `src/server.test.ts`, `src/rebalance-args.test.ts`
- Delete: `packages/plan-data/scripts/mcp.ts`; `@modelcontextprotocol/sdk` and the `mcp` script from
  `packages/plan-data/package.json`; then the old code nothing uses any more: `plan-data/src/{index,store,
  store.test,library,bundled,rebalance}.ts`, `src/calendar-sync/`, `google/kit.ts`, `outlook/kit.ts`, and the
  `"."` export. `pnpm exec nx run-many -t typecheck lint test -p @lc/plan-data` proves nothing else needed them.
- Modify: root `package.json` (`"mcp": "pnpm --silent --filter @lc/mcp run start"`; `test` list), `.oxlintrc.json`
  if an app rule is needed; `.mcp.json` stays as it is

**Interfaces:**
- Consumes: `createPlanServices`, `localPorts`, `findDataDir`, `LOCAL_ACTOR`, `createMemoryPorts`.
- Produces: `createMcpServer(services: PlanServices, actor: Actor): Server` (tools, resources and the prompt
  exactly as today); `requestFromTool(args: Record<string, unknown>, plan: Plan): RebalanceRequest` (moved).

- [ ] **Step 1: Write `server.test.ts`** with the SDK's `InMemoryTransport.createLinkedPair()` and a `Client`:

```ts
test('the same tools as before', async () => {
  const client = await connected(createMemoryPorts())
  expect((await client.listTools()).tools.map((t) => t.name)).toEqual([
    'get_guide', 'get_plan', 'get_accuracy', 'preview_update', 'apply_update', 'rebalance_calendar',
  ])
})

test('apply_update on a read-only host is refused with the reason', async () => {
  const client = await connected(createMemoryPorts({ writable: false }))
  const answer = await client.callTool({ name: 'apply_update', arguments: { changes: [{ type: 'plan.rename', title: 'X' }] } })
  expect(answer.isError).toBe(true)
  expect(JSON.stringify(answer.content)).toContain('The plan is read-only here')
})
```

  Move the `requestFromTool` `describe` from `plan-data` into `rebalance-args.test.ts` unchanged.
- [ ] **Step 2: Run.** `pnpm install && pnpm exec nx run @lc/mcp:test`. Expected: FAIL, then implement
  `server.ts` by moving the handlers so each calls one service method with `actor`, then PASS.
- [ ] **Step 3: Check it end to end.** Run `pnpm run mcp` with a JSON-RPC `tools/list` on stdin (or reconnect the
  `learning-curve` MCP server in this session) and call `get_guide`. Expected: the guide text.
- [ ] **Step 4: Commit.** `refactor(mcp): the MCP server as its own app over plan-service`

---

### Task 11: The planner takes `PlanView` and grouped props

**Files:**
- Modify: `modules/planner/src/pages/planner/ui/PlannerPage.tsx` (props), `pages/planner/model/use-plan-session.ts`
  (drops `PlannerState`), `pages/planner/index.ts`, `pages/timeline/ui/TimelinePage.tsx` (drops `TimelineState`),
  `pages/timeline/index.ts`, `src/index.ts`, the three page stories, `apps/web/src/routes/{index,timeline,focus}.tsx`

**Interfaces:**
- Produces (from `@lc/planner`, each with TSDoc carried over from today's prop comments):

```ts
export interface PlannerPlan {
  view: PlanView
  change: (change: PlanChange) => Promise<void>
  changeAll: (changes: readonly PlanChange[]) => Promise<void>
  travel: (cursor: number) => Promise<void>
  trimHistory: () => Promise<void>
}
export interface PlannerUrl { search: PlannerSearch; onSearchChange: (patch: PlannerSearch) => void }
export interface PlannerAbilities {
  library?: PlannerLibrary | undefined
  busy?: PlannerBusySource | undefined
  sync?: readonly CalendarSyncSource[] | undefined
  rebalance?: Rebalance | undefined
  focus?: ((uid: string) => void) | undefined
}
export interface PlannerSlots {
  renderActions?: ((shown: { plan: Plan; hidden: ReadonlySet<string> }) => ReactNode) | undefined
  renderExport?: ((dialog: { plan: Plan; hidden: ReadonlySet<string>; open: boolean; onClose: () => void }) => ReactNode) | undefined
  commands?: readonly PlannerCommand[] | undefined
}
export interface PlannerPageProps {
  plan: PlannerPlan
  url: PlannerUrl
  abilities?: PlannerAbilities | undefined
  slots?: PlannerSlots | undefined
}
```

  `TimelinePage`'s `state` becomes `view: PlanView`. `canEdit` is derived once per page as
  `view.access === 'owner'`. `PlannerState` and `TimelineState` are no longer exported. `onChangeAll` was optional
  and is now `plan.changeAll`, always given.

- [ ] **Step 1: Change the props and the stories; let typecheck lead.** Stories build a `PlanView` from the
  fixtures (`id: DEFAULT_PLAN` via `parsePlanId('default')`, `access: 'owner'`).
- [ ] **Step 2: Remove the temporary `canEdit` mapping from the web routes.**
- [ ] **Step 3: Verify.** `pnpm run check && pnpm run test && pnpm run stand:test`. Expected: PASS. Restart the
  dev server; the planner, timeline and focus pages behave as before (edit, undo, timeline draft, focus timer).
- [ ] **Step 4: Commit.** `refactor(planner): take the shared plan view and grouped props`

---

### Task 12: `@lc/docs-host` becomes the generic `@lc/remote-host`

**Files:**
- Move: `packages/docs-host/` → `packages/remote-host/`
- Create: `packages/remote-host/src/load-remote.ts` (generic), `src/docs/{index,load,use-docs-host}.ts`,
  `README.md`
- Modify: its `package.json` (`@lc/remote-host`, exports `"."` and `"./docs"`), `apps/web` (`DocsButton.tsx`,
  `package.json`), `apps/docs-harness` (imports, `package.json`), `.oxlintrc.json` (rename the override; harness
  may import `@lc/remote-host` and `@lc/remote-host/*`)

**Interfaces:**
- Produces:
  - `@lc/remote-host`: `loadRemote<T>(options: LoadRemoteOptions<T>): Promise<T>` with `LoadRemoteOptions<T> {
    manifestUrl: string; remoteName: string; module: string; hostName: string; isModule: (value: unknown) =>
    value is T; isCompatible: (module: T) => boolean; timeoutMs?: number | undefined }`; `class RemoteLoadError`
    with `reason: RemoteLoadFailure` (`'timeout' | 'unavailable' | 'shape' | 'version'`). The shared React
    singletons and the cache-busting manifest query move here unchanged.
  - `@lc/remote-host/docs`: every name `@lc/docs-host` exports today, unchanged, built on `loadRemote`; still
    loaded with `import()` on first use.

- [ ] **Step 1: Move and split; repoint the two consumers.**
- [ ] **Step 2: Verify.** `pnpm install && pnpm run check && pnpm run docs:test`. Expected: PASS (the harness
  loads the remote through the new package). Restart the dev server; the docs button opens the guide, and with
  the remote stopped it becomes the link.
- [ ] **Step 3: Commit.** `refactor: generalize the docs host into remote-host`

---

### Task 13: The graph check, READMEs and the architecture doc

**Files:**
- Create: `scripts/check-graph.ts`; `README.md` in every project that has none (`apps/web`, `apps/stand`,
  `apps/docs-harness`, `modules/*`, `packages/{plan-domain,plan-data,i18n,ui,docs-contract}`)
- Modify: root `package.json` (`check` runs `node scripts/check-graph.ts` first), `docs/architecture.md`,
  `CLAUDE.md`

**Interfaces:**
- Produces: `scripts/check-graph.ts` — reads every `apps/*`, `modules/*`, `packages/*` `package.json`, takes its
  `type:` tag and its `workspace:` dependencies, and exits 1 listing each edge the layer rule in Global Constraints
  forbids, or a project without exactly one `type:` tag. Runs with plain `node` (type stripping).

- [ ] **Step 1: Write the check and prove it bites.** Run it: Expected PASS. Add `"@lc/plan-data": "workspace:*"`
  to `modules/dashboard/package.json`, run it: Expected FAIL naming `@lc/dashboard → @lc/plan-data (module →
  infra)`. Revert.
- [ ] **Step 2: Write the READMEs.** Each: the job in one paragraph; its entries; what it may and never imports;
  how it is tested; the data files it owns, if any.
- [ ] **Step 3: Rewrite `docs/architecture.md`** for the layout as it now is: layers and tags, every project
  (the docs, harness, stand and MCP apps included), the graph, the folder-or-package rule, ports and adapters,
  where a new use case, port, adapter or page goes; phases 2–4 by link to the spec. Update `CLAUDE.md`: courses
  in `packages/plan-content`; `plan-data/fs` is the only writer of the data files; operations in `plan-service`;
  the MCP server in `apps/mcp`.
- [ ] **Step 4: Final verification.** `pnpm run plan && pnpm run check && pnpm run test && pnpm run build &&
  pnpm run docs:test`, the baseline comparison of Task 9 again, `diff` of `plan.json` against
  `plan.before.json`. Expected: all PASS, no difference. Open `pnpm run graph` and confirm the arrows match the
  spec's graph. Leave the dev server running.
- [ ] **Step 5: Commit.** `docs: the layered layout, a graph check and a README per project`
