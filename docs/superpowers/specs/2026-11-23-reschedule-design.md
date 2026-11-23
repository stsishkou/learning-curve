# Reschedule a calendar: shift by hours, re-balance, deadlines per calendar

Status: design, 2026-11-23. Replaces the "Shift the plan" dialog.

## Why

The person builds a study plan once from rules and then lives with it. Two things are hard today:

- **The time of day.** HF LLM sits at 11:00 for 35 sessions. "Shift the plan" moves sessions by whole days only, so
  moving a course to 12:00 means dragging every session, or editing the rules in code.
- **The density.** A course is one session per working day because the rules say so. Finishing it sooner (two on
  some days) or easing it (one every second day) has no tool. Catch up's "squeeze" only re-homes missed sessions.

And the one deadline the plan knows, the certificates', is fixed in code (`meta.certDeadline`, a `certs`
milestone made by `schedule.ts`). Any other course has none, so nothing can plan towards one.

The person wants a general tool, not a fix for this plan: pick a calendar, move it in time, or re-balance it,
optionally towards a deadline set for that calendar right there. The re-balancing must be genuinely balanced and
documented well enough to trust and to change.

## Goals

1. **Shift by hours**: the existing shift moves sessions by days and/or hours.
2. **Re-balance one calendar** from a date, in one of two modes:
   - **Pace**: the person sets the rhythm (from one session every three study days to three a day) and sees the
     finish date that results.
   - **Deadline**: the person sets a date and the planner finds the gentlest even rhythm that finishes by it.
3. **Deadlines per calendar**, optional, set or cleared in the same dialog; no deadline left in code.
4. **Balanced, explainable results**: the result is the best one under stated priorities, and when it falls
   short the dialog says why ("the weeks of 11 Jan – 7 Feb are full").
5. **Great documentation**: the algorithm, its model, its priorities and its limits written for a reader who wants
   to trust or change it.

## Non-goals

- Re-balancing several calendars at once, or moving other calendars to make room. One calendar moves; the rest of
  the plan is the fixed ground it moves around.
- Changing sessions' content, splitting or merging sessions, or changing lengths (Catch up's "pace" does lengths).
- The copy-paste AI chat in "Open plan file" gets no new powers: it has no tool calls. The MCP server does.
- Recurring events (the gym): they are obstacles, never moved.

## Anti-goals (a failure even if it works)

- A result that piles sessions up in whatever is free first, or leaves a long gap and then a crunch.
- Moving finished sessions, reordering a course's sessions, or touching another calendar.
- Going over the weekly budget, onto a holiday or a weekend, or onto the person's busy time without saying so.
- A re-balance that differs each time it is asked the same thing, or that moves sessions which were already fine.
- A heavy dependency in the browser bundle, or rules leaking into adapters (routes, MCP, server functions).

## Constraints from the project

- Every edit is a `PlanChange` handled by `applyChange` (`packages/plan-domain/src/changes.ts`); the JSON Schema
  (`schema.ts`), the guide (`guide.ts`) and `parseChange` change together, and `pnpm run test` fails when they drift.
- `plan-domain` is pure TypeScript with no runtime dependencies; `plan-data` is the Node side; modules never import
  `plan-data`, `node:*` or server functions: the app passes data and callbacks as props.
- Times are Europe/Minsk wall-clock strings and ms; use the `@lc/plan-domain` date helpers.
- UI text in ru/en/es through Paraglide; strict types (no `any`, `as`, `!`); Oxlint, Steiger, Oxfmt.
- Edits made here reach Google Calendar and Outlook through the sync engine like any other change.
- Shared dependency versions live in the `catalog` of `pnpm-workspace.yaml`.

## What exists today

| Piece | Where | What it does |
|---|---|---|
| `events.shift` | `changes.ts` | Every open session of one calendar (or all) on or after `from` moves by `days` (non-zero, ≤ 366). |
| `ShiftDialog` | `modules/planner/src/features/shift-plan` | Calendar (or all), from, days, ±1 day/week buttons, count. Opened from `⋮` and from Catch up. |
| `events.move` | `changes.ts` | Many sessions into new slots as **one history step** (Catch up uses it; `paced` flag). |
| `catchUpScenarios`, `planOutlook`, `withMoves` | `replan.ts` | Scenarios as move lists; outlook = finish, deadline margin (certs only), peak week, weeks over budget. |
| Rule warnings | `rules.ts` | Holiday, weekend, overlap, past a `milestone` of the same calendar, done changed. Warn, never refuse. |
| Deadlines | `meta.certDeadline`, a `certs` milestone from `schedule.ts` | Read by `planOutlook`, `Runway` (hard-codes `certs`), `GoalLadder`, dashboard `StatTiles`, `PaceForecast`. |
| Weekly budget | `meta.weeklyBudgetHours` (12) | Counted by the week bar and `pnpm run plan`. |
| Busy time | `plan-data/src/busy.ts` (`loadBusy`) | The person's own calendar, server-side, by range. |

Load in the current plan, study hours per week: certificates 10 h a week until 23 Dec; from 11 Jan to 7 Feb
exactly 12 h (HF LLM 5, HF Agents 5, Practical Python 2); 9, 7, 7, 7, 3 h after. Weekday slots from 4 Jan:
HF LLM (then Python) 11:00, HF Agents 12:00, Python 13:00 on Mon/Wed.

## Approaches considered

- **A. Fill day by day** (like Catch up's `push`): next free hour, following the pace; for a deadline, try faster
  paces until one fits. Simple and easy to explain, but not balanced: under full weeks everything piles into the
  first free room, which is exactly this plan's January/February shape.
- **B. Plan the load, then place**: (1) room per day, (2) load per day spread evenly within the room, with
  carry-over, (3) placement of the sessions in order. Testable step by step, explains its shortfalls.
- **C. A general optimisation solver** for the whole timetable: provably best under an objective, but a dependency,
  hard to explain, and too much as the whole answer.

**Picked: B with C at its core.** The person chose to combine them. Steps 1 and 3 stay explicit rules (B), which
keeps the result explainable and the model small; step 2, which session goes on which day, is one exact integer
program solved by HiGHS (C), so "balanced" means "optimal under stated priorities", not "what a heuristic happened
to do". This is the design below.

## Design

### 1. Deadlines per calendar

A calendar's deadline is its **milestone event**: an all-day event of `kind: 'milestone'` in that calendar, on
the deadline day. The certificates calendar already has one. This keeps one source of truth that already shows in
the grid, goes to Google, Outlook and the `.ics`, and that `ruleWarnings` already checks (a session of the
calendar ending after the milestone's start warns).

- **Meaning**: sessions of the calendar must end before the deadline day starts (`end <= deadline T00:00`), the
  rule `rules.ts` already applies. The dialog words it as "finish before <day>".
- **One per calendar**: the earliest milestone of a calendar is its deadline (`deadlineOf(plan, calendarId)` in
  `plan-domain`); `nextDeadline(plan, now)` gives the nearest one ahead across calendars.
- **Setting it in the dialog**: an optional date per calendar. Setting a new one adds the milestone with the
  existing `event.add` (title `Дедлайн: <calendar name>`, all day), changing it patches its day with `event.patch`,
  clearing it removes it with `event.remove` (to the trash). No new change kind.
- **No deadline in code**: `meta.certDeadline` and `meta.lastCertDay` leave `PlanMeta`, the plan schema and the
  guide. `schedule.ts` still generates the certificates' milestone from its config: that is content, not a rule.
  Readers move to the helpers: `planOutlook.deadlineMargin` becomes the margin of the nearest deadline ahead (or
  of a given calendar); `Runway` draws the calendar of the nearest deadline instead of `certs`; `GoalLadder`,
  `StatTiles` and `PaceForecast` use `nextDeadline`. With no deadline anywhere they hide that part. Plan files in
  the library that still carry `certDeadline` open as before: the field is ignored.

### 2. Shift by hours

`events.shift` gains `hours?: number | undefined`: a whole or half number between −23.5 and 23.5. `days` becomes
optional too; together they must not both be zero. Every target keeps its length and moves by
`days × DAY + hours × HOUR`.

- A shift that would make any target cross midnight (start and end on different days) is **refused** with the
  first such session named: the rules say a session starts and ends on the same day, and silently clamping would
  change lengths.
- The dialog gains an hours field next to days, and `+1 h` / `−1 h` buttons. The count line also says how many
  targets would overlap something after the shift (from `previewUpdate` warnings).
- Schema, guide (the change table) and `parseChange` change together; the history text reads "Shifted by 1 d 2 h"
  / "Shifted by 1 h".

### 3. Re-balance

#### 3.1 Request and result

```ts
interface RebalanceRequest {
  /** The plan on screen: the stored plan, or a plan file opened in the browser with its unsaved edits */
  plan: Plan
  calendar: string
  /** The deadline typed in the dialog, YYYY-MM-DD; absent: the calendar's own deadline, if any */
  deadline?: string | undefined
  /** First day that may change, YYYY-MM-DD; today at the earliest */
  from: string
  /** `pace`: sessions per study day, one of 1/3, 1/2, 1, 3/2, 2, 3; `deadline`: finish before the calendar's deadline */
  target: { mode: 'pace'; perDay: number } | { mode: 'deadline' }
  /** Weeks may go over the weekly budget; otherwise the budget is hard */
  overBudget: boolean
  /** Study hours of a day, `HH:MM`; sessions are placed only inside */
  hours: { from: string; to: string }
}

interface RebalanceResult {
  moves: SessionMove[]          // only sessions whose slot changes
  report: RebalanceReport       // finish, peak day/week, weeks over budget, late, unplaced, moved, reasons
}
```

The **sessions that move** are the calendar's open sessions (`isSession`, not done, not `kind: 'review'`) that
start on or after `from`, in their current order. Everything else in the plan is fixed ground, including reviews:
a review belongs to a module that is already done, so its spacing (1, 3, 7 days after) must not follow the course.
A **study day** is a day from `from` on that is not a holiday, not taken whole by an all-day busy block of the
person's own calendar (a trip, a day off; the report names such days), and is a weekday, or a weekend day of the
kind the calendar's moving sessions already use (a Saturday counts when one of them is on a Saturday; reviews do
not count).

**Lengths** stay as they are, whatever they are (1 h, 2 h labs, 1:15 after Catch up's pace, 0:30 halves of a
split). Every session is one contiguous block; starts are on the 30-minute grid, and a length that is not a
multiple of 30 minutes takes room rounded up to the next one. A **lab** is `kind: 'lab'` only: one block, at most
one a day.

**Study hours** default to the smallest window holding the start and end of at least 90 % of the plan's open
weekday sessions (11:00–14:00 for this plan); the person can widen it in the dialog (say 10:00–15:00 to make
room). Not stored: it is part of the request.

#### 3.2 Step 1: room (rules, `plan-domain`)

For each study day up to the **horizon** (the deadline in deadline mode; in pace mode `from` + 1.5 × the days the
pace needs + 14 days; never more than 366 days):

- **Free slots**: 30-minute grid inside the study hours, minus every busy occurrence of every other event
  (`occurrences`, repeats such as the gym included; `free` events do not block), minus the person's busy time when
  a busy calendar is connected, minus anything already past `now`. The moving sessions' own current slots count as
  free. A moving session's current slot that lies outside the study hours (a certificate session put at 21:00 by
  hand) is room on that day **for that session only**: it was put there on purpose and may stay.
- **Day room** `cap_d`: how many hours of sessions fit in the free slots without overlapping (greedy packing of
  1-hour blocks on the grid), and `lab_d`: whether a 2-hour block fits.
- **Week room** `left_w`: the weekly budget minus the hours of everything else that counts towards the budget that
  week (the definition the week's load bar uses), never below zero.

The room map is kept for the report: a week with `left_w = 0` or days with `cap_d = 0` are the reasons the
result cannot be better.

#### 3.3 Step 2: which session on which day (exact, HiGHS)

`plan-domain` builds a small mixed-integer program in a neutral form (variables, bounds, constraints, objective);
`plan-data` solves it. Notation: sessions `i = 1..n` in order with length `len_i` (1 h or a 2 h lab), study days
`d = 1..D` up to the horizon, weeks `w`.

Variables:

- `y[i,d] ∈ {0,1}`: session `i` is on day `d`. Only created where it could go (`lab_d` for a lab, `cap_d ≥ len_i`).
- `u_i ∈ {0,1}`: session `i` finds no day before the horizon (unplaced). Unplaced sessions are always the tail of
  the course: `u_i ≤ u_{i+1}`, so nothing placed comes after something left out.
- `late_i ∈ {0,1}`: in deadline mode, session `i` goes after the deadline. The horizon then runs past the deadline
  by the pace-mode rule (1.5 × the study days the course needs + 14, at most 366 days from `from`), so a shortfall
  shows as **late** sessions with their days, not as unplaced ones. Unplaced is left for the 366-day cap and for a
  lab that finds no 2-hour block anywhere.
- `over_w ≥ 0`: hours over the week's room, only when `overBudget` is on; otherwise fixed at 0.
- `e_d ≥ 0`: how far the placed hours by day `d` are from the ideal line (below).
- `P_week`, `P_day`: the heaviest week (all study, this calendar included) and the most hours of this calendar in a day.

Constraints:

1. **Each session once**: `Σ_d y[i,d] + u_i = 1`.
2. **Order kept**: for every `i < n` and day `d`: `Σ_{d' ≤ d} y[i+1,d'] ≤ Σ_{d' ≤ d} y[i,d'] + u_i` (session
   `i+1` is never on an earlier day than `i`). Within a day, step 3 keeps the order by time.
3. **Day room**: `Σ_i len_i · y[i,d] ≤ cap_d`; **at most one lab a day**: `Σ_{i lab} y[i,d] ≤ 1`.
4. **Week room**: `Σ_{d ∈ w} Σ_i len_i · y[i,d] ≤ left_w + over_w`.
5. **Peaks**: `fixed_w + Σ_{d ∈ w} Σ_i len_i · y[i,d] ≤ P_week` and `Σ_i len_i · y[i,d] ≤ P_day`.
6. **Ideal line**: with `C_d = Σ_{d' ≤ d} Σ_i len_i · y[i,d']` (hours placed by day `d`), `C_d − I_d ≤ e_d` and
   `I_d − C_d ≤ e_d`, where the **ideal** `I_d` is
   - deadline mode: `H · k_d / K`, the straight line from `from` to the last study day before the deadline (`H`
     total hours, `k_d` the study days up to `d`, `K` all study days before the deadline);
   - pace mode: `min(H, perDay · avgLen · k_d)`, the rhythm asked for until the course is done.

Objective, **lexicographic**: solved as a sequence, each level's optimum fixed as a constraint for the next, so a
lower priority can never buy itself at the cost of a higher one, and no weights need tuning.

| Level | Deadline mode | Pace mode |
|---|---|---|
| 1 | Fewest unplaced, then fewest late, then least `Σ over_w` | Fewest unplaced |
| 2 | Lowest `P_week`, then lowest `P_day`: the gentlest load that still finishes in time | Least `Σ e_d`: closest to the rhythm asked, then least `Σ over_w` |
| 3 | Least `Σ e_d`: as close to an even line to the deadline as possible | Lowest `P_week`, then `P_day` |
| 4 | Fewest sessions whose day changes: `Σ_i (1 − y[i, day_i])` | Same |
| 5 | Earliest days, `Σ d · y[i,d]`: a deterministic tie-break | Same |

**Going over the budget**, when the person allows it, serves what they asked for and nothing else: in deadline
mode it is used only as far as it saves sessions from being late; in pace mode only as far as it keeps the rhythm
(it ranks right after the rhythm). Without the checkbox `over_w` is 0 and the budget is hard. There is no weekly cap
beyond each day's room; the report lists every week that goes over and by how much.

Level 4, with step 3 keeping a session's current time when its day stays, is what makes the tool **stable**:
asking twice moves nothing the second time, and sessions already in a good place stay. Level 5 makes the answer
unique for a given input.

Size and limits: about 35 sessions × 60–120 days is a few thousand binaries; HiGHS solves it in well under a second.
Each level gets a time limit (2 s); a level that stops at the limit keeps its best solution and the report says the
result is "good, not proven best" with the gap. Requests above 300 sessions or 366 days are refused with a
message.

#### 3.4 Step 3: placement (rules, `plan-domain`)

For each day, in session order, choose the start times from the day's free slots:

1. The session's **current slot**, when its day did not change and the slot is still free (even outside the study
   hours, see step 1). Otherwise the calendar's **usual start** for that weekday (the most common start of its
   sessions on that weekday before the re-balance), then the slot right after the previous session of the day,
   then the nearest free slot inside the study hours, later before earlier.
2. A lab takes a free 2-hour block.
3. Sessions of a day run in their order by time.

Step 2's day room is a count of hours, so fragmented free time can, rarely, refuse a lab or a second session. Then
that day's room is lowered by the hours that did not fit and step 2 runs again (at most three rounds); what still
does not fit is reported as unplaced, never squeezed in.

A session **moves** when its slot changes (day or time); `moves` lists only those. While anything is unplaced,
Apply is off and the report says why (no room before the 366-day limit, a lab without a 2-hour block) and what
would help (wider study hours, allowing the budget to be exceeded, a later deadline).

#### 3.5 Report

From the result and the room map: the finish day (and before), the margin to the deadline, the heaviest week and
day, weeks over budget, how many sessions move, late and unplaced counts, and **reasons**, the binding facts in
plain words: weeks with no room left ("11 Jan – 7 Feb are full"), days with no free study hours, the deadline
being too close for the room ("fits 28 of 35 sessions before 15 Feb"), a lab that found no 2-hour block. The dialog
also shows the rule warnings of the resulting `events.move` from `previewUpdate`.

#### 3.6 Where the code goes

- `packages/plan-domain/src/rebalance/`: `room.ts` (step 1), `model.ts` (step 2's program in a neutral
  `LpModel` form, and reading its solution back), `placement.ts` (step 3), `report.ts`, `index.ts` with
  `planRebalance(plan, request, now, busy, solve)`. `solve: (model: LpModel) => Promise<LpSolution>` is injected,
  so the domain stays free of dependencies and is tested with a real solver from `plan-data`.
- `packages/plan-data/src/solver.ts`: `solveLp` with the `highs` package (MIT, WebAssembly), loaded once; writes
  the model in CPLEX LP format, reads the column values. Pin in the catalog the newest release that is at least two
  weeks old.
- `apps/web/src/server/reschedule.ts`: a server function `rebalanceCalendar(request)` that loads the busy blocks
  for the horizon when a busy calendar is connected, runs `planRebalance` on the plan in the request with
  `solveLp`, and returns `RebalanceResult`: one round trip per preview, all solving on the server. It stores
  nothing, so it is offered wherever the app runs, read-only hosts and opened plan files included (Apply stores
  the moves the way the dialog's other edits are stored there). The server solves one request at a time (a queue,
  like the sync engine's), and the limits in step 2 bound each one.
- MCP (`packages/plan-data/scripts/mcp.ts`): a tool `rebalance_calendar` that returns the result as an update
  (`{ changes: [events.move] }`) plus the report, to pass to `preview_update` and `apply_update`. The guide lists
  the tool. No rules in the adapter.
- Planner: the `shift-plan` feature becomes `reschedule` with `RescheduleDialog`; `PlannerPage` takes a
  `rebalance?: (request) => Promise<RebalanceResult>` prop, absent where the host cannot solve.

#### 3.7 How it is saved

The dialog stores the result's moves as one `events.move`, the change Catch up uses: one history step, one Undo,
and the calendar apps follow. `events.move` gains an optional `reason: 'rebalance'` so the history reads
"Re-balanced Hugging Face: LLM Course" instead of "Moved 23 sessions". A deadline set in the same dialog is its own
step, stored first. The request itself is not stored: replaying it later could give another plan (the busy
calendar changes), while the moves replay exactly.

### 4. The dialog

"Shift the plan" becomes **Reschedule** (`⋮` and Catch up's link open it):

```
Reschedule
Calendar  [Hugging Face: LLM Course ▾]      From [4 Jan 2027]
Deadline  [ none ]                           finish before this day; kept as the calendar's deadline

(•) Move          days [ 0 ]   hours [ +1 ]   [+1 h] [−1 h] [+1 day] [+1 week] [−1 week]
( ) Re-balance    pace  [1 every 3 days | 1 every 2 days | 1 a day | 3 in 2 days | 2 a day | 3 a day]
                  [ ] fit the deadline instead      Study hours [11:00]–[14:00]   [ ] may go over 12 h a week

Ends 15 Feb (was 22 Feb) · heaviest week 12 h · 23 sessions move · 0 without room
The weeks of 11 Jan – 7 Feb are full: widen the study hours or allow going over the budget to finish sooner.
⚠ 3 sessions share their time with Hugging Face: AI Agents Course
                                                                     [Cancel] [Apply]
```

- Move works with all calendars as today; Re-balance needs one calendar.
- "Fit the deadline" is available once the Deadline field has a date (the calendar's, or one typed above); the
  request carries the typed date, so the preview works before anything is stored.
- The result recomputes 300 ms after the last change of an input, with a skeleton of the summary while it runs;
  an older answer never overwrites a newer request.
- Apply stores the deadline change (if any), then the moves; failures show inline like the shift does today.

### 5. Documentation

- `docs/rebalancing.md` (new): why the three steps, the room rules, the program with every constraint and the
  priority table, why lexicographic, what "balanced" guarantees and what it does not, limits and time-outs, and a
  worked example on a small plan with the numbers, kept in step with a test that runs that example.
- README: the Reschedule dialog (move by days and hours, re-balance, deadlines per calendar).
- `docs/architecture.md`: the split between `plan-domain/src/rebalance` (model) and `plan-data/src/solver.ts`
  (solver), the injected `solve`, the `rebalance` prop.
- The guide: `events.shift` with `hours`, the deadline as a milestone, the MCP tool.

### 6. Tests

- `plan-domain`: room (holidays, weekends kept only when used, repeats and busy blocks, past slots, own slots free,
  budget left), placement (usual start first, labs on 2-hour blocks, order within a day, the re-solve round),
  `events.shift` with hours (midnight refused, both zero refused, schema/guide/parse in step), deadlines
  (`deadlineOf`, `nextDeadline`, widgets without a deadline).
- `plan-data`, with the real HiGHS solver, as properties over generated plans and the worked example:
  order kept; nothing placed on other events, holidays, unused weekends or busy time; within the budget unless
  allowed; before the deadline whenever the room allows it; **idempotent** (re-balancing the result moves nothing);
  **deterministic** (same input, same moves); in deadline mode the heaviest week is no heavier than any other valid
  placement found by brute force on small cases; in pace mode the gap between consecutive sessions stays within one
  study day of the rhythm where the room allows.
- Stories for the dialog: move by hours, re-balance by pace, by deadline, a shortfall with reasons, the
  read-only host.

## Calls left to the builder

- Exact layout and copy of the dialog within the design system; the order of the summary facts.
- The LP text format details and HiGHS options beyond the time limit.
- How `Runway` picks among several calendars with deadlines when two are equally near.
