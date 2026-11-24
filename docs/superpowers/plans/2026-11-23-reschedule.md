# Reschedule a calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deadlines per calendar, shifting sessions by hours, and an exact, documented re-balancing of one calendar
(by pace or towards its deadline), all in one Reschedule dialog.

**Architecture:** Deadlines become the calendars' milestone events read through two `plan-domain` helpers.
`events.shift` gains `hours`. Re-balancing is three steps in `packages/plan-domain/src/rebalance/` (room, an integer
program in a neutral `LpModel` form solved level by level, placement); the solve function is injected and provided by
`packages/plan-data/src/solver.ts` with HiGHS, called from a server function and an MCP tool. The planner's
`shift-plan` feature becomes `reschedule`.

**Tech Stack:** TypeScript 7, Vitest, `highs` 1.15.4 (HiGHS in WebAssembly, MIT), TanStack Start server functions,
React 19, Paraglide, Storybook stories as tests.

**Spec:** `docs/superpowers/specs/2026-11-23-reschedule-design.md`

## Global Constraints

- Every edit is a `PlanChange`; `schema.ts`, `guide.ts` and `parseChange` change together and `pnpm run test` must pass.
- `plan-domain` has no runtime dependencies; modules never import `plan-data`, `node:*` or server functions.
- Times are Europe/Minsk wall-clock strings and ms; use the date helpers of `@lc/plan-domain`, never `new Date(localString)`.
- No `any`, no `as`, no `!`; `computed`-style rules do not apply (React); comments only for *why*.
- UI text in `packages/i18n/messages/{ru,en,es}.json`, called as `m.key()`; run `pnpm run check:i18n`.
- `highs` pinned at `1.15.4` in the `catalog` of `pnpm-workspace.yaml` (newest release at least two weeks old).
- Solver limits: 2 s per level; requests above **300 sessions** or a horizon past **366 days** are refused.
- Paces offered: **1/3, 1/2, 1, 3/2, 2, 3** sessions per study day.
- Study-hours default: the smallest window holding the start and end of at least **90 %** of open weekday sessions.
- Horizon: deadline mode and pace mode both run to `from` + ⌈1.5 × ⌈n / perDay⌉⌉ + 14 study-calendar days (perDay = 1
  in deadline mode), and at least to the deadline; never past `from` + 366 days.
- Never stage `packages/plan-data/data/edits.json` or `plan.json`: they hold the person's uncommitted edits. Run
  `pnpm run plan` when rules change, and leave `plan.json` unstaged.
- Before each commit: `pnpm run fmt`, then `pnpm run check`; Conventional Commits, body lines ≤ 100 characters, no
  Claude attribution.

## Review Focus

- A calendar with nothing left to move (all done, or `from` after its last session): `planRebalance` returns no
  moves and a report saying so; the dialog keeps Apply off. Test in Task 7.
- A session missed earlier today when `from` is today: it is placed in a future slot, never in a past one. Test in
  Task 7.
- A deadline on or before `from`: refused with "The deadline must come after the first day" before any solving.
  Test in Task 5.
- A calendar whose sessions are all on Saturdays: Saturdays are its study days, weekdays are not taken over.
  Test in Task 5 (and in Task 7 end to end).
- Inputs changed faster than the solver answers: an older answer never replaces a newer one in the dialog. Story in
  Task 9.

---

### Task 1: Deadlines per calendar in the domain

**Files:**
- Create: `packages/plan-domain/src/deadlines.ts`, `packages/plan-domain/src/deadlines.test.ts`
- Modify: `packages/plan-domain/src/types.ts:40-50` (drop `certDeadline`, `lastCertDay` from `PlanMeta`),
  `schema.ts:136-145`, `schedule.ts` (stop writing both meta fields; keep generating the certificates' milestone
  from `config.certDeadline`), `replan.ts:40-70` (`planOutlook`), `index.ts`,
  `packages/plan-data/scripts/build-plan.ts:13` (log the nearest deadline instead of `lastCertDay`),
  `packages/plan-domain/src/guide.ts` (meta description), fixtures if they set the fields.

**Interfaces:**
- Produces: `deadlineOf(plan: Plan, calendar: string): string | null` — the day (`YYYY-MM-DD`) of the earliest
  `kind: 'milestone'` event of the calendar.
- Produces: `nextDeadline(plan: Plan, now: number): { calendar: string; day: string } | null` — the nearest deadline
  on or after today across calendars (ties: calendar order in `plan.calendars`).
- Produces: `PlanOutlook.deadlineMargin` keeps its meaning (days between the last open session of the deadline's
  calendar and the deadline) for `nextDeadline`.

- [ ] **Step 1: Write the failing tests** in `deadlines.test.ts` with `fixturePlan`:
  `deadlineOf(fixturePlan, 'certs')` equals the certs milestone's day; `deadlineOf` of a calendar without a milestone
  is `null`; with two milestones in one calendar the earlier wins; `nextDeadline` skips milestones before today and
  returns `null` when none is ahead; `planOutlook(plan, now).deadlineMargin` is `null` for a plan without milestones.
- [ ] **Step 2: Run** `pnpm --filter @lc/plan-domain exec vitest run src/deadlines.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `deadlines.ts`, export both from `index.ts`, switch `planOutlook` to `nextDeadline`,
  remove the meta fields from the type, the schema and `schedule.ts`'s output, update `build-plan.ts` and the guide.
- [ ] **Step 4: Run** `pnpm run test` and `pnpm exec nx run-many -t typecheck` — Expected: domain tests PASS;
  typecheck fails only in the four widgets of Task 2 (`Runway`, `GoalLadder`, `StatTiles`, `PaceForecast`).
- [ ] **Step 5:** do not commit yet; Task 2 completes the change (the tree must typecheck at each commit).

### Task 2: Widgets read deadlines per calendar

**Files:**
- Modify: `modules/planner/src/widgets/runway/ui/Runway.tsx:25-45` (draw the calendar of `nextDeadline`, not `'certs'`;
  render nothing when there is none), `modules/planner/src/widgets/goal-ladder/ui/GoalLadder.tsx:85-100`,
  `modules/dashboard/src/widgets/stat-tiles/ui/StatTiles.tsx:15-60`,
  `modules/dashboard/src/widgets/pace-forecast/ui/PaceForecast.tsx:30-40`, their stories where they build meta.

**Interfaces:**
- Consumes: `deadlineOf`, `nextDeadline` (Task 1).

- [ ] **Step 1: Update the stories** of the four widgets so one story has no milestone in the plan and asserts the
  deadline part is absent (`queryByText(<deadline text>)` is `null`), and the default story still shows the
  certificates' date from the milestone.
- [ ] **Step 2: Run** `pnpm run stand:test` — Expected: the new no-deadline stories FAIL (typecheck or render).
- [ ] **Step 3: Implement** the four widgets on the helpers; a widget whose whole subject is the deadline hides when
  `nextDeadline` is `null`.
- [ ] **Step 4: Run** `pnpm run plan` (leave `plan.json` unstaged), `pnpm run check`, `pnpm run test`,
  `pnpm run stand:test` — Expected: all PASS.
- [ ] **Step 5: Commit** Tasks 1–2: `feat(plan-domain): read deadlines from each calendar's milestone instead of the plan settings`.

### Task 3: Shift by hours, and a re-balance named in the history

**Files:**
- Modify: `packages/plan-domain/src/changes.ts` (type at :68-74, parse at :223-262, apply at :444-470),
  `schema.ts:314-345`, `guide.ts:190-196` and `:236-241`, `history.ts:73-81` (`subjectOf`),
  `changes.test.ts`, `modules/planner/src/features/history/model/describe-step.ts:20-31`, the three message files.

**Interfaces:**
- Produces: `{ type: 'events.shift'; calendar?: string | undefined; from: string; days?: number | undefined; hours?: number | undefined }`
  — `days` integer in −366..366, `hours` a multiple of 0.5 in −23.5..23.5, not both zero or absent.
- Produces: `{ type: 'events.move'; moves: SessionMove[]; paced?: boolean | undefined; reason?: 'rebalance' | undefined; calendar?: string | undefined }`
  — `calendar` names the re-balanced calendar so `subjectOf` returns its name.
- Produces messages: `history_shifted` → "Shifted by {amount}: {name}" (`amount` like `+1 d 2 h`, `−1 h`),
  `history_rebalanced` → "Re-balanced: {name}".

- [ ] **Step 1: Write the failing tests** in `changes.test.ts`: shift by `hours: 1` moves `2026-11-23T12:00` to
  `13:00` and keeps the length; `days: 1, hours: -1` combines; `hours: 0.25` is refused ("hours must be whole or half");
  both absent/zero refused; a target ending at `23:30` with `hours: 1` refused with its title in the message
  ("…would cross midnight"); `events.move` with `reason: 'rebalance', calendar: 'certs'` is one step whose subject is
  the certs calendar's name. Add the new fields to the `EXAMPLES` table so the schema/guide/parse drift test covers them.
- [ ] **Step 2: Run** `pnpm --filter @lc/plan-domain exec vitest run src/changes.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** parse, schema (`days` no longer required; `hours` number with `multipleOf: 0.5`), apply
  (`days × DAY + hours × HOUR`, refuse a midnight crossing before changing anything), guide rows, `subjectOf`, and
  `describeStep` with the two messages in ru/en/es.
- [ ] **Step 4: Run** `pnpm run test && pnpm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(plan-domain): shift sessions by hours and name a re-balance in the history`.

### Task 4: HiGHS solver and level-by-level solving

**Files:**
- Create: `packages/plan-domain/src/rebalance/lp.ts`, `packages/plan-domain/src/rebalance/lp.test.ts`,
  `packages/plan-data/src/solver.ts`, `packages/plan-data/src/solver.test.ts`
- Modify: `pnpm-workspace.yaml` (catalog `highs: 1.15.4`), `packages/plan-data/package.json` (dependency
  `highs: catalog:`), `packages/plan-data/src/index.ts`, `apps/web/vite.config.ts:20` (add `/^highs/` to the Nitro
  rollup `external` list so its `highs.wasm` stays beside its loader).

**Interfaces:**
- Produces (domain, `lp.ts`):
  ```ts
  interface LpTerm { v: string; c: number }
  interface LpVariable { name: string; kind: 'binary' | 'integer' | 'continuous'; lower: number; upper: number | null }
  interface LpConstraint { name: string; terms: LpTerm[]; op: '<=' | '>=' | '='; rhs: number }
  interface LpModel { variables: LpVariable[]; constraints: LpConstraint[]; objective: LpTerm[] }   // minimise
  interface LpSolution { status: 'optimal' | 'time-limit' | 'infeasible' | 'error'; values: Record<string, number>; objective: number; gap: number }
  type Solve = (model: LpModel, options: { timeLimit: number }) => Promise<LpSolution>
  solveInOrder(model: Omit<LpModel, 'objective'>, levels: LpTerm[][], solve: Solve, timeLimit?: number):
    Promise<{ values: Record<string, number>; provenBest: boolean; gap: number }>
  ```
  `solveInOrder` solves level 1, adds `Σ level₁ ≤ value₁ + 1e-6·max(1, |value₁|)` as a constraint, solves level 2,
  and so on; a level that ends at the time limit keeps its best value, sets `provenBest = false` and the largest gap;
  `infeasible` or `error` at level 1 throws `Error('The model has no solution')`.
- Produces (data, `solver.ts`): `solveLp: Solve` — loads HiGHS once (module-level promise), writes the model in CPLEX
  LP format (`Minimize`, `Subject To`, `Bounds`, `Binaries`, `Generals`, `End`), passes `{ output_flag: false,
  time_limit }`, maps `Status` `Optimal` → `optimal`, `Time limit reached` → `time-limit`, `Infeasible` →
  `infeasible`, anything else → `error`; `gap` from `mip_gap` when present, else 0.

- [ ] **Step 1: Write the failing tests.** `solver.test.ts`: the README's workshop model as an `LpModel` (maximise
  written as minimising `−30 chairs − 50 tables`) gives `chairs = 20`, `tables = 10`; an infeasible model reports
  `infeasible`. `lp.test.ts` with a fake `Solve` that records models: `solveInOrder` with two levels sends the second
  model with the first level's bound as a constraint, and returns `provenBest: false` when a fake level reports
  `time-limit`.
- [ ] **Step 2: Run** `pnpm --filter @lc/plan-data exec vitest run src/solver.test.ts` and the domain test — Expected: FAIL.
- [ ] **Step 3: Install and implement:** `pnpm install` after the catalog and package edits, then `lp.ts` and `solver.ts`.
- [ ] **Step 4: Run** both tests, `pnpm run check`, `pnpm run build` — Expected: PASS, and
  `apps/web/.output/server/node_modules/highs/` contains `highs.wasm` (or the build log shows `highs` external).
- [ ] **Step 5: Commit** `feat(plan-data): solve integer programs with HiGHS, level by level`.

### Task 5: Step 1 — room, request and the sessions that move

**Files:**
- Create: `packages/plan-domain/src/rebalance/types.ts`, `room.ts`, `room.test.ts`, `request.ts`, `request.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  const PACES = [1 / 3, 1 / 2, 1, 3 / 2, 2, 3] as const
  type RebalanceTarget = { mode: 'pace'; perDay: number } | { mode: 'deadline' }
  interface RebalanceRequest { calendar: string; from: string; deadline?: string | undefined; target: RebalanceTarget;
    overBudget: boolean; hours: { from: string; to: string } }
  type RebalanceReason =
    | { kind: 'nothing-to-move' } | { kind: 'full-weeks'; from: string; to: string } | { kind: 'days-off'; days: string[] }
    | { kind: 'late'; placed: number; total: number; deadline: string } | { kind: 'no-lab-block'; title: string }
    | { kind: 'limit' } | { kind: 'not-proven'; gap: number }
  interface RebalanceReport { finish: string | null; finishBefore: string | null; deadline: string | null;
    peakWeek: number; peakDay: number; overWeeks: { week: string; hours: number }[]; moved: number; late: number;
    unplaced: number; provenBest: boolean; reasons: RebalanceReason[] }
  interface RebalanceResult { moves: SessionMove[]; report: RebalanceReport }
  ```
- Produces (`request.ts`): `parseRebalanceRequest(value: unknown, plan: Plan): RebalanceRequest` (throws with a
  readable message: unknown calendar, bad day, pace not in `PACES`, deadline mode without a deadline anywhere,
  deadline on or before `from` → "The deadline must come after the first day", `hours.from >= hours.to`);
  `defaultStudyHours(plan: Plan): { from: string; to: string }`;
  `movingSessions(plan: Plan, request: RebalanceRequest): PlanEvent[]` — the calendar's `isSession`, not done, not
  `kind: 'review'`, starting on or after `from`, by start.
- Produces (`room.ts`):
  ```ts
  interface RoomDay { day: string; week: string; index: number; slots: number[]; cap: number; lab: boolean }
  interface Room { days: RoomDay[]; weeks: Map<string, { left: number; fixed: number }>; deadline: string | null;
    daysOff: string[]; own: Map<string, { day: string; start: number; end: number; outside: boolean }> }
  roomOf(plan: Plan, request: RebalanceRequest, sessions: PlanEvent[], now: number, busy: BusyBlock[]): Room
  ```
  `slots` are free 30-minute starts (ms) inside the study hours; `cap` hours of non-overlapping 30-minute blocks;
  `lab` true when two free hours are contiguous; `index` counts study days from 1; `week` is the Monday; `left` =
  `max(0, weeklyBudgetHours − fixed)` where `fixed` is `weeklyHours` of the plan without the moving sessions; `own`
  holds each moving session's current slot, `outside: true` when it lies outside the study hours. The horizon follows
  Global Constraints; holidays, all-day busy blocks (`daysOff`) and weekend days the moving sessions do not use are
  not study days.

- [ ] **Step 1: Write the failing tests** with small hand-made plans (helpers in the test file):
  - `defaultStudyHours(fixturePlan)` is `{ from: '11:00', to: '14:00' }` on the real plan copy
    (`packages/plan-data/data/plan.json` read through `isPlan`), and ignores the two certificate sessions at 21:00/22:00.
  - A day with another calendar's session at 12:00–13:00 and study hours 11:00–14:00 has `slots` 11:00, 11:30, 13:00,
    13:30, `cap` 2 and `lab` false (no two contiguous free hours); with study hours 11:00–15:00 `lab` is true
    (13:00–15:00); the gym repeat (08:30–10:30) blocks nothing inside the study hours.
  - Holidays and an all-day busy block are not study days; the all-day one is listed in `daysOff`.
  - A calendar with only Saturday sessions has Saturdays as its only study days (Review Focus).
  - The moving sessions' own slots are free; one at 21:00 outside 11–14 is in `own` with `outside: true`.
  - Past slots of today are not room (`now` = today 12:10 → today's slots start at 12:30).
  - `left` for a week at 12 h of other calendars is 0.
  - `parseRebalanceRequest` refusals above, each with its message (Review Focus: deadline on `from`).
- [ ] **Step 2: Run** `pnpm --filter @lc/plan-domain exec vitest run src/rebalance` — Expected: FAIL.
- [ ] **Step 3: Implement** `types.ts`, `request.ts`, `room.ts` using `occurrences` (blocking unless `availability:
  'free'`), `weeklyHours`, `parseLocal`, `ymd`, `weekday`, `mondayOf`.
- [ ] **Step 4: Run** the tests and `pnpm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(plan-domain): work out the room a calendar can be re-balanced into`.

### Task 6: Step 2 — the integer program

**Files:**
- Create: `packages/plan-domain/src/rebalance/model.ts`, `packages/plan-domain/src/rebalance/model.test.ts`

**Interfaces:**
- Consumes: `Room`, `RebalanceRequest` (Task 5), `LpModel`, `LpTerm` (Task 4).
- Produces: `buildModel(room: Room, sessions: PlanEvent[], request: RebalanceRequest, budget: number):
  { model: Omit<LpModel, 'objective'>; levels: LpTerm[][] }` and
  `readDays(values: Record<string, number>, room: Room, sessions: PlanEvent[]): { days: (string | null)[]; late: boolean[] }`
  (`null` = unplaced), with variable names `y_<i>_<d>`, `u_<i>`, `late_<i>`, `L_<d>`, `C_<d>`, `e_<d>`, `over_<w>`,
  `t_<i>`, `Pw`, `Pd` (indices, not uids, so names stay LP-safe).

The model, sparse on purpose (dense prefix sums would be about a million nonzeros):

- `y_i_d` binary only where it may go: `cap_d ≥ len_i` (room length rounded up to 30 min) or `d` is the session's own
  day with `outside: true`; a lab (`kind: 'lab'`) only where `lab_d`.
- Once: `Σ_d y_i_d + u_i = 1`. Tail: `u_i − u_{i+1} ≤ 0`.
- Day index: `t_i = Σ_d index_d · y_i_d`. Order: `t_i − t_{i+1} − D·u_{i+1} ≤ 0` (D = number of study days).
- Load: `L_d = Σ_i len_i · y_i_d` (real hours). Room: `Σ_{i not own-outside on d} roomLen_i · y_i_d ≤ cap_d`.
  Labs: `Σ_{i lab} y_i_d ≤ 1`.
- Week: `Σ_{d∈w} L_d − over_w ≤ left_w` (`over_w` only when `request.overBudget`; otherwise the row has no `over_w`).
- Peaks: `fixed_w + Σ_{d∈w} L_d ≤ Pw` (as `Σ L_d − Pw ≤ −fixed_w`), `L_d − Pd ≤ 0`.
- Line: `C_d = C_{d−1} + L_d`, `C_d − e_d ≤ I_d`, `−C_d − e_d ≤ −I_d`, with `I_d` from the spec §3.3 (deadline mode:
  `H · min(index_d, K) / K`; pace mode: `min(H, perDay · avgLen · index_d)`).
- Late (deadline mode): `late_i − Σ_{d ≥ deadline} y_i_d = 0`.
- Levels — deadline: `[Σu] [Σlate] [Σover] [Pw] [Pd] [Σe] [−Σ_i y_i_{own day}] [Σ t]`;
  pace: `[Σu] [Σe] [Σover] [Pw] [Pd] [−Σ_i y_i_{own day}] [Σ t]`.

- [ ] **Step 1: Write the failing tests** (structure only, no solver): a 3-session, 4-day room yields `y` variables
  only on days with room and a lab only on `lab` days; the order rows exist for pairs (1,2), (2,3); no `over_` variable
  when `overBudget` is false; deadline-mode levels start with the `u`, `late`, `over` sums; pace-mode level 2 is
  `Σe`; `readDays` maps a hand-written value set back to days and `null`.
- [ ] **Step 2: Run** `pnpm --filter @lc/plan-domain exec vitest run src/rebalance/model.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `buildModel` and `readDays`.
- [ ] **Step 4: Run** the tests and `pnpm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(plan-domain): model a re-balance as an integer program`.

### Task 7: Step 3 — placement, report and `planRebalance`

**Files:**
- Create: `packages/plan-domain/src/rebalance/placement.ts`, `report.ts`, `index.ts`;
  `packages/plan-data/src/rebalance.ts`, `packages/plan-data/src/rebalance.test.ts`
- Modify: `packages/plan-domain/src/index.ts` (export the public names), `packages/plan-data/src/index.ts`

**Interfaces:**
- Consumes: Tasks 4–6.
- Produces (domain): `planRebalance(plan: Plan, request: RebalanceRequest, now: number, busy: BusyBlock[], solve: Solve):
  Promise<RebalanceResult>` — refuses more than 300 sessions; runs room → model → `solveInOrder` → placement; on a day
  where placement fails, lowers that day's `cap` by the hours that did not fit and solves again (at most 3 rounds);
  `moves` holds only sessions whose start or end changes.
- Produces (domain): `placeDay(day: RoomDay, sessions: PlanEvent[], usual: Map<number, number>, own: Room['own']):
  { placed: SessionMove[]; failed: PlanEvent[] }` with the preference order of spec §3.4 (own slot when still free →
  usual start for the weekday → right after the previous session → nearest free slot, later before earlier).
- Produces (domain): `reportOf(...)`: `RebalanceReport` per spec §3.5; `reasons` include `nothing-to-move`,
  `full-weeks` (consecutive weeks with `left = 0` between `from` and the finish), `days-off`, `late`, `no-lab-block`,
  `limit`, `not-proven`.
- Produces (data): `rebalanceCalendar(plan: Plan, request: RebalanceRequest, now: number): Promise<RebalanceResult>`
  — loads busy blocks for `from`..`from + 366 d` with `loadBusy` when a busy feed is set (ignores a failing feed),
  calls `planRebalance` with `solveLp`, one request at a time (a promise queue like `calendar-sync/engine.ts`'s).

- [ ] **Step 1: Write the failing tests** in `plan-data/src/rebalance.test.ts` with the real solver, on generated
  plans (a seeded generator in the test: 2–4 calendars, 10–40 sessions, random fixed events, holidays) and on a copy of
  `data/plan.json`:
  - order kept: the moved calendar's sessions sorted by new start keep their old order;
  - nothing lands on another busy event, a holiday, an all-day busy day or an unused weekend day;
  - with `overBudget: false` no week of the horizon goes over 12 h unless it already did without the calendar;
  - deadline mode: every session ends before the deadline whenever a brute-force check on small cases (≤ 6 sessions,
    ≤ 8 days) finds a valid placement, and the heaviest week equals the brute-force minimum;
  - pace mode at 1/2: consecutive sessions are 2 study days apart wherever the room allows;
  - **idempotent**: re-balancing the result with the same request returns no moves;
  - **deterministic**: the same request twice returns identical moves;
  - a session at 21:00 whose day stays keeps 21:00; reviews never move;
  - Review Focus: a calendar with nothing to move returns `moves: []` and reason `nothing-to-move`; a session missed
    earlier today gets a slot after `now`;
  - on the real plan, HF LLM from 2027-01-04 with deadline 2027-02-16, budget hard: finish 2027-02-15 or earlier,
    no week over 12 h.
- [ ] **Step 2: Run** `pnpm --filter @lc/plan-data exec vitest run src/rebalance.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** placement, report, `planRebalance` and the data wrapper.
- [ ] **Step 4: Run** `pnpm run test` (the whole suite under 60 s) and `pnpm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(plan-domain): re-balance a calendar evenly by pace or towards its deadline`.

### Task 8: Server function and MCP tool

**Files:**
- Create: `apps/web/src/server/reschedule.ts`
- Modify: `packages/plan-data/scripts/mcp.ts` (tool list and dispatch; the handler becomes `async`),
  `packages/plan-domain/src/guide.ts` (one line: re-balancing is the planner's Reschedule dialog or the
  `rebalance_calendar` tool; its result is an `events.move` with `reason: 'rebalance'`).

**Interfaces:**
- Consumes: `rebalanceCalendar` (Task 7), `parseRebalanceRequest`, `isPlan`.
- Produces: `rebalancePlan = createServerFn({ method: 'POST' })` with input `{ plan: Plan; request: RebalanceRequest }`
  validated by `isPlan` and `parseRebalanceRequest`, returning `RebalanceResult`; available on read-only hosts.
- Produces MCP tool `rebalance_calendar` — input `{ calendar, from, mode: 'pace' | 'deadline', perDay?, deadline?,
  overBudget?, hoursFrom?, hoursTo? }`; output JSON `{ update: { changes: [{ type: 'events.move', moves, reason:
  'rebalance', calendar }] }, report }`, or `{ update: null, report }` when nothing moves; `readOnlyHint: true`.

- [ ] **Step 1: Write the failing test** in `packages/plan-data/src/rebalance.test.ts`: "the MCP arguments map to a
  request" for `requestFromTool(args: Record<string, unknown>, plan: Plan): RebalanceRequest` exported from
  `rebalance.ts` — `{ calendar: 'hfllm', from: '2027-01-04', mode: 'pace', perDay: 0.5 }` gives `overBudget: false`
  and `hours` = `defaultStudyHours(plan)`; `mode: 'deadline'` without a deadline anywhere throws.
- [ ] **Step 2: Run** it — Expected: FAIL.
- [ ] **Step 3: Implement** the helper, the tool and the server function.
- [ ] **Step 4: Verify** `pnpm run check && pnpm run test && pnpm run build`; start the build with a `PLAN_DATA_DIR`
  copy and call the MCP tool through `pnpm run mcp` (a JSON-RPC `tools/call` on stdin) — Expected: a report with
  `finish` for HF LLM.
- [ ] **Step 5: Commit** `feat(web): offer re-balancing to the planner and to MCP clients`.

### Task 9: The Reschedule dialog

**Files:**
- Rename: `modules/planner/src/features/shift-plan` → `modules/planner/src/features/reschedule`
  (`ShiftDialog.tsx` → `RescheduleDialog.tsx`, stories likewise)
- Create: `modules/planner/src/features/reschedule/model/use-rebalance.ts`, `model/deadline-change.ts`
- Modify: `modules/planner/src/pages/planner/ui/PlannerPage.tsx:52,180,267,555` (import, prop, render),
  `modules/planner/src/pages/planner/model/build-actions.tsx:124-131` (label `m.reschedule()`), `apps/web/src/routes/index.tsx`
  (`rebalance={(plan, request) => rebalancePlan({ data: { plan, request } })}`), the three message files.

**Interfaces:**
- Consumes: `deadlineOf` (Task 1), `events.shift` with `hours` (Task 3), `RebalanceRequest`, `RebalanceResult`,
  `PACES`, `defaultStudyHours`, `movingSessions` (Task 5).
- Produces: `PlannerPage` prop `rebalance?: ((plan: Plan, request: RebalanceRequest) => Promise<RebalanceResult>) | undefined`.
- Produces: `deadlineChange(plan: Plan, calendar: string, day: string | null): PlanChange | null` — `event.add` of an
  all-day `kind: 'milestone'` titled `Дедлайн: <calendar name>` when none exists, `event.patch` of the existing one's
  `start`/`end` when the day differs, `event.remove` when cleared, `null` when unchanged.
- Produces: `useRebalance(rebalance, plan, request | null): { result: RebalanceResult | null; working: boolean; error: string }`
  — debounced 300 ms; a response for an older request is dropped (a request counter), so an older answer never
  replaces a newer one.
- Messages (en; ru and es alongside): `reschedule` "Reschedule", `reschedule_hint`, `reschedule_move` "Move",
  `reschedule_rebalance` "Re-balance", `reschedule_hours` "By how many hours", `reschedule_hour_later` "+1 h",
  `reschedule_hour_earlier` "−1 h", `reschedule_deadline` "Deadline", `reschedule_deadline_hint` "Finish before this
  day; kept as the calendar's deadline", `reschedule_pace` "Pace", `reschedule_pace_1_3` "1 every 3 days",
  `reschedule_pace_1_2` "1 every 2 days", `reschedule_pace_1` "1 a day", `reschedule_pace_3_2` "3 in 2 days",
  `reschedule_pace_2` "2 a day", `reschedule_pace_3` "3 a day", `reschedule_fit_deadline` "Fit the deadline instead",
  `reschedule_study_hours` "Study hours", `reschedule_over_budget` "May go over {hours} h a week",
  `reschedule_ends` "Ends {day} (was {before})", `reschedule_peak` "heaviest week {hours} h",
  `reschedule_moves` "{count} sessions move", `reschedule_unplaced` "{count} without room", `reschedule_late`
  "{count} after the deadline", one `reschedule_reason_<kind>` per `RebalanceReason` kind with its values,
  `reschedule_working` "Working out the best placement…", `reschedule_need_calendar` "Re-balancing needs one calendar".

- [ ] **Step 1: Write the failing stories** in `RescheduleDialog.stories.tsx`: Move by `+1 h` sends
  `{ type: 'events.shift', calendar, from, hours: 1 }` (days omitted when 0); Re-balance by pace calls `rebalance` with
  `target { mode: 'pace', perDay: 0.5 }` and shows the ends line from a fake result; deadline typed → "Fit the deadline"
  enabled and Apply sends the `event.add` milestone first, then `events.move` with `reason: 'rebalance'`; a shortfall
  result shows its reasons and keeps Apply off while `unplaced > 0`; a slow fake answering an older request after a
  newer one does not overwrite it (Review Focus); without `rebalance` the Re-balance mode is absent.
- [ ] **Step 2: Run** `pnpm run stand:test` — Expected: the new stories FAIL.
- [ ] **Step 3: Implement** the dialog (layout per spec §4, `Segmented` for the mode and the paces, existing
  `FIELD`/`INPUT` styles, `RuleWarningList` from `previewUpdate` of the result's `events.move`), the two model files,
  the page prop and the route wiring.
- [ ] **Step 4: Run** `pnpm run check && pnpm run test && pnpm run stand:test && pnpm run build`, then open the
  production build on a `PLAN_DATA_DIR` copy, re-balance HF LLM by deadline and by pace, check light, dark and 390 px
  width — Expected: all PASS; the dialog shows the ends line, reasons and warnings; Apply then Undo restores the plan.
- [ ] **Step 5: Commit** `feat(planner): reschedule a calendar by hours or re-balance it, with its deadline`.

### Task 10: Documentation

**Files:**
- Create: `docs/rebalancing.md`, `packages/plan-data/src/rebalance.example.test.ts`
- Modify: `README.md` (the Reschedule dialog: move by days and hours, re-balance, deadlines per calendar; the
  dependency note for HiGHS), `docs/architecture.md` (`plan-domain/src/rebalance` builds the model,
  `plan-data/src/solver.ts` solves it, the injected `solve`, the `rebalance` prop, the server function and the MCP tool).

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the example test**: a small plan (one calendar, 6 sessions with one lab, another calendar
  holding 12:00 on two days, a holiday, budget 6 h) re-balanced by deadline and by pace 1/2; assert the exact moves,
  finish and peak week that `docs/rebalancing.md` quotes.
- [ ] **Step 2: Run** it — Expected: PASS once the numbers are filled in from the actual result (the test pins them).
- [ ] **Step 3: Write `docs/rebalancing.md`**: why three steps; the room rules; the program (variables, every
  constraint, the levels table for both modes) with why lexicographic; what "balanced" guarantees (order, room, budget,
  deadline when feasible, minimal peak, closeness to the line, stability, determinism) and what it does not (other
  calendars never move, lengths never change, the 2 s limit); the worked example with its numbers; how to change a
  priority safely (which test pins it).
- [ ] **Step 4: Run** `pnpm run fmt:check && pnpm run test` — Expected: PASS.
- [ ] **Step 5: Commit** `docs: explain how a calendar is re-balanced, with a worked example the tests run`.
