# Re-balancing a calendar

Re-balancing moves the open sessions of **one calendar**, from a chosen day on, onto the study days ahead, and
keeps them in order. It can work in two ways:

- **at a pace**: one session every three study days, every two, one a day, three in two days, two a day or three a
  day. The result shows when the course ends.
- **towards a deadline**: the gentlest even rhythm that still finishes before the day given.

It is the `Re-balance` mode of the planner's `Reschedule` dialog (`⋮` → `Reschedule`). MCP clients get it as the
`rebalance_calendar` tool. Either way, the result is a list of moves stored as one `events.move` with
`reason: 'rebalance'`: one history step that a single Undo takes back. A deadline typed in the dialog is kept as
the calendar's milestone, and is stored as its own step before the moves.

This document is for a reader who wants to trust the result or change how it is reached. It explains:

- the three steps;
- every rule and every row of the program;
- the order in which the aims are met;
- what the result guarantees and what it does not;
- a worked example whose numbers a test checks.

## Where the code is

| Step | Code | Tests |
|---|---|---|
| What moves, the request | `packages/plan-domain/src/rebalance/request.ts` | `request.test.ts` |
| 1. Room | `packages/plan-domain/src/rebalance/room.ts` (`roomOf`) | `room.test.ts` |
| 2. Which day: the targets and the program | `packages/plan-domain/src/rebalance/model.ts` (`rhythmDays`, `targetDays`, `reachOf`, `buildModel`) | `model.test.ts` |
| 2. Which day: the order of aims | `packages/plan-domain/src/rebalance/lp.ts` (`solveInOrder`) | `lp.test.ts` |
| 2. Which day: the solver | `packages/plan-data/src/solver.ts` (`solveLp`, HiGHS) | `solver.test.ts` |
| 3. What time | `packages/plan-domain/src/rebalance/placement.ts` (`placeDay`) | `placement.test.ts` |
| Report | `packages/plan-domain/src/rebalance/report.ts` (`reportOf`) | through `planRebalance` |
| All together | `packages/plan-domain/src/rebalance/index.ts` (`planRebalance`) | `packages/plan-data/src/rebalance.test.ts`, `rebalance.example.test.ts` |
| The change it stores | `packages/plan-domain/src/rebalance/change.ts` (`rebalanceChange`) | `change.test.ts` |
| Server, MCP | `packages/plan-data/src/rebalance.ts`, `queue.ts`, `apps/web/src/server/reschedule.ts`, `packages/plan-data/scripts/mcp.ts` | `rebalance.test.ts`, `queue.test.ts` |

`plan-domain` builds the program in a neutral form (`LpModel`: variables, rows, an objective) and never imports
a solver. `planRebalance` takes a `solve` function. `plan-data` passes `solveLp`, which runs
[HiGHS](https://highs.dev) through the `highs` package (WebAssembly). The domain tests pass a fake solver, and the
`plan-data` tests pass the real one.

## Why three steps

```
request ─▶ 1. room          what the plan allows: study days, free half hours, room per day and per week
        ─▶ 2. which day     a target day for each session from the rhythm, then an integer program over
                            (session, day) that meets every rule and aim, solved one aim at a time
        ─▶ 3. what time     the start of each session on its day, by plain preferences
        ─▶ report           the finish, the heaviest week, what moved, and why it cannot be better

   step 3 cannot fit what step 2 put on a day ─▶ that day gets less room, step 2 runs again (at most 3 rounds)
```

- **The room is rules.** Holidays, weekends, other events, the weekly budget and the study hours are facts of
  the plan, not choices, so a few plain functions with their own tests compute them.
- **Choosing the days is the hard part.** Several aims pull against each other here: order, room, budget,
  deadline, evenness, and leaving good sessions alone. A greedy pass that puts each session in the first free
  place piles sessions up at the start, or leaves a gap and then a crunch. That is exactly the result this
  feature must not give. So each session first gets a **target day** from the rhythm asked for. An integer
  program then states every aim, the rhythm among them, and finds the best placement, and the solver can prove
  that it is the best.
- **The time of day is a local choice.** Once a session's day is known, a person would keep its current slot or
  use the course's usual hour. Keeping times out of the program keeps it small: one variable per session and day,
  rather than one per session and half hour, which would be six to sixteen times as many.

Step 2 counts each day's room in hours. Sometimes the free time is in pieces that cannot hold a session at all, or
not in order. Step 3 then reports the hours it could not place, that day's room is lowered by them, and step 2
runs again. After three rounds, whatever still does not fit is reported as without room. It is never squeezed in.

## What moves

`movingSessions` takes the calendar's open sessions (not done) that start on or after the first day, in order
of start. Some sessions are left out:

- finished ones;
- ones before the first day;
- reviews, because their spacing after a finished module must not follow the course.

Everything else in the plan is fixed ground: other calendars, repeats such as the gym, and the excluded sessions.

The request (`RebalanceRequest`) carries:

- the calendar;
- the first day;
- the target (`{ mode: 'pace', perDay }` with `perDay` one of `1/3, 1/2, 1, 3/2, 2, 3`, or `{ mode: 'deadline' }`);
- optionally a deadline typed in the dialog (otherwise the calendar's own milestone, if any);
- whether weeks may go over the budget;
- the study hours.

By default, the study hours are the smallest window, on the half-hour grid, that holds the start and the end of at
least nine in ten open weekday sessions (`defaultStudyHours`). A couple of sessions moved to the evening by hand
do not stretch it. A plan with no open weekday sessions falls back to 10:00–18:00.

## Step 1: room

`roomOf` gives the study days of the year from the first day, the room on each day and in each week, and the
current slot of each moving session.

**Study days** are the weekdays. Saturday or Sunday counts only if the moving sessions already use that day. A
course studied only at weekends keeps to the weekend days it uses and never spills into weekdays. Holidays are
not study days. A day that the person's own calendar takes whole (an all-day busy block) is a day off: it is not a
study day, and the report names it.

**A year.** The room covers the 366 days from the first day, at any pace and towards any deadline. A course kept
to a few weekend days, or squeezed by full weeks, needs far more calendar days than it has sessions, and a
deadline months ahead must be reachable. The program does not use all of it: step 2 keeps only
[the days it needs](#the-days-the-program-needs).

**Free slots.** These are the 30-minute starts inside the study hours where nothing busy is. The following block a
slot:

- every occurrence of every other event (repeats included), unless it is marked `free`;
- the busy time of the person's own calendar, when one is connected;
- any slot that has already started.

All-day plan events block nothing: they are markers.

The moving sessions' own slots count as free, since those sessions are the ones being placed.

A moving session whose current slot lies **outside the study hours** and is still ahead (a session put at 21:00
by hand) keeps that slot as room for itself alone. It was put there on purpose and may stay there.

**Day room.** `cap_d` is half an hour for each free slot. `lab_d` says whether the day holds four free slots in a
row, which is the two hours a lab needs. A session takes its length rounded up to the half hour.

**Week room.** `fixed_w` is the hours of everything else in week `w` that counts towards the weekly budget. That
is every timed event that is busy and does not repeat, the same rule the week's load bar uses. The room left in
the week is `left_w = max(0, budget − fixed_w)`.

## Step 2: which session on which day

### The rhythm

`rhythmDays` runs one pass over the sessions, in order. It is given a **gap**, in study days, and a first day.
The first session aims at the first day and each next one `gap` study days after the one before it, rounded down
to a day. A fraction carries over, so a gap of 2/3 gives two sessions, one, two, one. Each session lands on the
first day from its aim on where it fits, never before the previous session's day. "Fits" uses the program's own
rules: the day's room (or its own day, for a session outside the study hours), one lab a day, and the week's room
unless going over is allowed.

When a session has to wait for room, the rhythm **starts again from the day it lands on**: the next session aims
`gap` days after that day, not after the aim it missed. A stretch without room, such as a week whose budget is
spent or days that have passed, is never made up for with a crunch after it. A session that finds no day at all
leaves the rest of the course without one too, since only the end of a course can be left out.

### The earliest day of each session

`earliestDays` is the rhythm without a gap: each session on the first day from the previous session's day where it
fits.

No valid placement puts any session earlier than this day. The proof is by induction. The sessions before session
`i` are each no earlier than their earliest day, and they keep their order. So on every day the pass skipped for
`i`, they would leave `i` no more room than the pass did. The day's own room and lab block do not depend on the
placement at all.

The program uses this bound in three ways:

- **No variable before it.** The program has no `y` for a session before its earliest day. A session with no
  earliest day at all gets no `y`, so it is left out.
- **The most that can be in time.** Towards a deadline, it places the most sessions that can possibly finish
  before it.
- **A start** for the solver when the targets leave out a session that it can place.

The rhythm and the program must use the same rules. If they disagree, the bound is wrong and the program refuses
placements that are valid.

### The target of each session

`targetDays` gives each session the day it aims at, `τ_i`:

- **At a pace**, the rhythm with a gap of `1 / perDay` study days, starting at the course's first session. A
  re-balance changes the rhythm, not where the course starts. A first session that has already passed starts
  again today, by the restart rule.
- **Towards a deadline**, the **slowest** rhythm that still has every session before the deadline: the gentlest
  even rhythm that finishes in time. It is found by halving the gap 40 times between 0 and the number of study days
  before the deadline, far finer than a day. The rhythm starts at the course's first session, or at the first day
  when that lets it run slower. It keeps to the budget whenever that still finishes in time, even when going over
  is allowed, since going over serves only to be in time. When even the earliest placement cannot finish in time,
  the targets are that placement, as nothing finishes sooner.

A session the rhythm cannot place has no target, and the rhythm costs nothing for it.

### The days the program needs

`reachOf` cuts the year to what the program can use:

- **Towards a deadline every session can meet**, the study days before the deadline. Being late ranks right after
  being left out, so no best answer uses a later day.
- **Otherwise**, the study days up to 10 after the furthest day a session aims at or can first reach. The levels
  after the rhythm then have room to move, and a course that does not fit before its deadline shows as late
  sessions on real days, not as sessions without room.

### Notation

Sessions are `i = 0 … n−1`, in order. Session `i` lasts `len_i` hours, takes `room_i` of a day's room (its length
rounded up to the half hour) and aims at day `τ_i`. The study days the program keeps are `d = 1 … D`, and weeks
are `w`. `own_i` is the day session `i` is on now.

### Variables

The names below are the names in the model and in the LP text that `solver.ts` writes. Each name uses indices,
never uids.

| Variable | Kind | Meaning |
|---|---|---|
| `y_i_d` | binary | session `i` is on day `d`. Only exists where it could be: from its earliest day on, on its own outside day, or where `cap_d ≥ room_i` and, for a lab, `lab_d` |
| `u_i` | binary | session `i` is left out (no room within the days the program keeps) |
| `late_i` | binary | towards a deadline only: session `i` is on or after the deadline |
| `Y_i_d` | 0…1 | session `i` is on day `d` or before: a running sum of its `y` |
| `t_i` | 0…D | the index of session `i`'s day, for the last tie-break |
| `L_d` | ≥ 0 | hours of the calendar on day `d` |
| `over_w` | ≥ 0 | hours over the week's room. Only exists when going over is allowed; otherwise the budget is hard |
| `Pw` | ≥ 0 | the heaviest week: everything that counts, this calendar included |
| `Pd` | ≥ 0 | the calendar's heaviest day |

### Rows

| Row | Constraint | Why |
|---|---|---|
| `reach_i_d` | `Y_i_d = Y_i_(d−1) + y_i_d` | the running sum |
| `once_i` | `Y_i_D + u_i = 1` | each session is placed once, or left out |
| `order_i_d` | `Y_(i+1)_d ≤ Y_i_d` | session `i+1` is never on an earlier day than session `i` |
| `tail_i` | `u_i ≤ u_(i+1)` | only the end of the course can be left out, so nothing placed comes after a gap |
| `day_i` | `t_i = Σ_d d · y_i_d` | the day index, for the tie-break |
| `late_i` | `late_i = Σ_(d ≥ deadline) y_i_d` | towards a deadline: late means on the deadline day or after it |
| `load_d` | `L_d = Σ_i len_i · y_i_d` | the day's hours |
| `room_d` | `Σ_i room_i · y_i_d ≤ cap_d` | the day's room. A session on its own outside slot does not take it |
| `labs_d` | `Σ_(i lab) y_i_d ≤ 1` | at most one lab a day |
| `peakd_d` | `L_d ≤ Pd` | the heaviest day |
| `week_w` | `Σ_(d ∈ w) L_d ≤ left_w (+ over_w)` | the week's room |
| `peakw_w` | `fixed_w + Σ_(d ∈ w) L_d ≤ Pw` | the heaviest week |

**The rhythm** needs no row. It is a cost on each `y`: `Σ_i Σ_d len_i · |d − τ_i| · y_i_d`, the session's hours
for every study day between the day it lands on and its target.

**Why a cost per session.** A line for the course as a whole, hours placed so far against hours that should be
placed by each day, looks simpler. But a course that loses days to a full week is then behind the line, and the
closest it can get is to catch up: three sessions on the day after. A cost per session and day measures each
session against its own target, and the target already starts again after the lost days. There is nothing to
catch up with, and no running total to carry.

**Why running sums for the order.** The order could be written on day indices, `t_(i+1) ≥ t_i`, which is a smaller
model. But the LP relaxation of that form (the program with the 0/1 variables allowed to take any value between)
is so weak that HiGHS could not place this repository's HF LLM course (about 35 sessions) in its time limit: most
of them were still left out when level 1 stopped. `Y_(i+1)_d ≤ Y_i_d` has three nonzeros a row, and its relaxation
is tight.

### The order of aims

The program is not solved once with a weighted sum of aims: weights would trade one aim against another, for
example one more late session for a lighter week. Instead the aims are **levels**, minimised one after another
(`solveInOrder`). Each level is solved with every level before it held at its best value. A lower aim therefore
never buys anything at the cost of a higher one, and there are no weights to tune.

| Level | Towards a deadline | At a pace |
|---|---|---|
| 1 | fewest left out, `Σ u_i` | fewest left out, `Σ u_i` |
| 2 | fewest late, `Σ late_i` | closest to the rhythm, `Σ len_i · ∣d − τ_i∣ · y_i_d` |
| 3 | least over the budget, `Σ over_w` (only when allowed) | least over the budget, `Σ over_w` (only when allowed) |
| 4 | closest to the rhythm, `Σ len_i · ∣d − τ_i∣ · y_i_d` | lightest heaviest week, `Pw` |
| 5 | lightest heaviest week, `Pw` | lightest heaviest day, `Pd` |
| 6 | lightest heaviest day, `Pd` | most sessions on their own day, `−Σ_i y_i_(own_i)` |
| 7 | most sessions on their own day, `−Σ_i y_i_(own_i)` | earliest days, `Σ t_i` |
| 8 | earliest days, `Σ t_i` | — |

What the order means:

- **Towards a deadline**, the course first finishes in time as far as the room allows. Then it follows the
  slowest even rhythm that does so. The heaviest week and day only settle what the rhythm leaves open.
- **At a pace**, the rhythm asked for comes first. The load is then as light as that rhythm allows.
- **Going over the budget**, when allowed, serves only what was asked. Towards a deadline, it is used only as far
  as it saves sessions from being late. At a pace, it is used only as far as it keeps the rhythm. It ranks right
  after those aims, so it is never used for anything else.
- **Staying put** comes after every aim of the result. A session that is already in a good place keeps its day,
  and step 3 then keeps its time.
- **The earliest days** settle what is still tied.

**Why the week does not come first.** A lighter heaviest week sounds like the gentlest result. But the week counts
every calendar, and other courses are rarely spread evenly. On this repository's plan, the other courses fill
January. With the heaviest week ranked above the rhythm, a re-balance of HF LLM towards 31 March or 31 May gave one
session in January, nothing for a month, then three on some days. With the rhythm first, the course runs evenly
from 4 January to the deadline, never more than one session a day: about one every two study days towards 31
March, one every three towards 31 May. Its heaviest week towards 31 March is 10 h instead of 8 h, still inside
the 12 h budget.

**When the program decides.** The targets follow the program's own rules. So when they place every session, and
no level above the rhythm asks for something else, they are the best placement: the rhythm costs nothing there and
more anywhere else, and the solver proves this at once. The program decides the rest:

- a session the rhythm cannot place within the year, which an earlier day can still take;
- going over the budget towards a deadline, when it is allowed and needed;
- every tie the rhythm leaves open.

A level with no terms (going over, when it is not allowed) is skipped.

Each level's bound is its best value plus `10⁻⁶ · max(1, |value|)`. Without that slack, a value that the solver
met within its own tolerance would make the next level infeasible.

**Time.** Each level has **2 seconds**. It starts from the solution of the level before it. Level 1 starts from
the targets, or from the earliest placement when the targets leave out a session it can place. That start meets
every bound so far, so a level stopped by its time limit always keeps a solution at least as good as the start.
The result is then marked as not proven best, with the largest gap the solver reported. If a later level fails
outright, the result of the levels before it stands, also marked as not proven.

## Step 3: what time

`placeDay` gives the sessions of each day their start times, in order. Each session tries, in turn:

1. its **current slot**, when its day did not change and the slot is still free. A slot outside the study hours
   is room for that session alone, so it stays too;
2. the calendar's **usual start** for that weekday: its most common start on that weekday among its sessions
   inside the study hours, the earlier one on a tie;
3. the slot right **after the previous session** of the day;
4. the free slot **nearest** to where the day's sessions are heading, the later one on a tie.

Each session starts after the one before it ends, and takes whole half hours of the day's free slots. A choice is
taken only if the sessions after it still fit, each at its earliest start. Without that check, a session's own
slot at 13:00 could shut the next session out of a day that has room for both. A session that finds no room
fails, and the round described under [Why three steps](#why-three-steps) takes over.

A session **moves** when its slot changes, in day or in time. `moves` lists only those sessions.

## The report

| Field | Meaning |
|---|---|
| `finish`, `finishBefore` | the day of the last session after the re-balance, and before it |
| `deadline` | the deadline in force: typed, or the calendar's milestone |
| `peakWeek` | hours of the heaviest week, everything that counts |
| `peakDay` | hours of the calendar's heaviest day |
| `overWeeks` | each week over the budget, with how far over |
| `moved`, `late`, `unplaced` | sessions that move, that land on or after the deadline, that found no room |
| `provenBest` | false when a level stopped at its time limit, or a later level failed |
| `reasons` | the facts that bound the result |

At a pace, the deadline is not an aim, but `late` still counts the sessions that land after it.

The reasons, and when each one appears:

| Reason | When | The dialog says |
|---|---|---|
| `nothing-to-move` | no open sessions from the first day | "The calendar has no open sessions from this day on." |
| `full-weeks` | the budget is hard and weeks up to the finish have no room left, as runs of weeks | "The weeks of … are full: widen the study hours or allow going over the budget to finish sooner." |
| `days-off` | days taken whole by the person's calendar, up to the finish | "No free study hours on …" |
| `late` | sessions land on or after the deadline | "Fits … of … sessions before …: a later deadline, wider study hours or going over the budget would help." |
| `no-lab-block` | a lab is left out and no study day has two free hours in a row | "“…” needs two free hours in a row, and the study hours have none." |
| `limit` | other sessions find no room within the year | "Some sessions find no room within a year: widen the study hours or allow going over the budget." |
| `not-proven` | a level stopped at its time limit | "The search stopped at its time limit, so a better placement may exist." |

While any session is without room, nothing is offered to store: `rebalanceChange` gives no change, so the
dialog's Apply stays off and the MCP tool's `update` is null. Storing the rest would move them around that session
and leave it where it was, on top of whatever took its place. The dialog also lists the rule warnings that
`previewUpdate` gives for the resulting `events.move`.

## What "balanced" guarantees

Every guarantee below holds whenever the result is proven best. The last column names the test that checks it.

| Guarantee | Why it holds | Test |
|---|---|---|
| **Order**: the sessions keep their order, and only the end of the course can be left out | `order`, `tail`, and step 3 placing a day's sessions in order | generated plans, `model.test.ts` |
| **Room**: no session on another busy event, a holiday, a day off, a weekend the course does not use, busy time of the connected calendar, a slot that has passed, or outside the study hours (except its own slot there) | step 1, and step 3 placing only on free slots | `room.test.ts`, "never on another busy event, …" |
| **Budget**: no week over the budget unless allowed. When allowed, going over is used only as far as it serves the aim | `week_w`, and level 3 right after the aim it serves | generated plans, `model.test.ts` |
| **Deadline**: every session before it whenever the room allows | level 2 towards a deadline, right after the left-out count | "towards a deadline, against every possible placement" |
| **Gentlest rhythm**: towards a deadline, the slowest even rhythm that finishes in time, so no day holds more sessions than every placement that finishes in time needs | the targets, and level 4 | the brute force over every placement on small cases, "HF LLM towards a far deadline …" |
| **Rhythm**: at a pace, each session on the day the rhythm gives it whenever the room allows, at most `⌈perDay⌉` sessions on a day | the targets, and level 2 | "at half a session a day the sessions are two study days apart", "HF LLM at … a day …" |
| **No crunch to catch up**: after a stretch without room (a full week, days that have passed), the course goes on at its rhythm instead of making up for the days | the rhythm starting again where a session lands | "a re-balance never makes up for lost days with a crunch" |
| **Stability**: asking the same again moves nothing; sessions already in a good place keep their day and time | the rhythm starting where the course does, so the same question gives the same targets; and step 3 keeping a slot whose day stays | "asking again moves nothing", the worked example |
| **Determinism**: the same question gives the same answer | the earliest-days level, and HiGHS being deterministic on the same model | "the same answer comes twice" |

## What it does not do

- **Other calendars never move**, and nor does anything else outside the moving sessions. To make room in
  another course, re-balance that course too.
- **Lengths never change.** Sessions are not split or merged. Catch up's options work with lengths.
- **Reviews and finished sessions stay**, and so do sessions before the first day.
- **2 seconds a level.** On this repository's plan, HF LLM (35 sessions) is proven best at every pace and towards
  every deadline tried, from 16 February to 31 May, each in 1.5 s or less in all. A larger or more crowded course
  can still stop a level at its limit: the result is valid and the dialog says it may not be the best.
- **The heaviest week is not the first aim.** Towards a deadline the rhythm ranks above it, so a week can be
  heavier than the lightest possible. It stays inside the budget unless going over is allowed.
- **Determinism ends at the time limit.** A level stopped by the clock depends on how far the solver got, so two
  asks can then differ. The `not-proven` reason says when this applies.
- **Step 2 counts hours, not shapes.** Free time in pieces can refuse a session that the day's hours would hold.
  Three rounds usually settle this. What still does not fit is reported, never forced in.
- **The person's calendar is read when asked.** If it does not answer, its busy time is unknown and treated as
  free. The person's own calendar is never written to.
- **Limits.** At most 300 sessions: a larger request is refused with a message. The room is the year from the first
  day, and a session that finds none within it is reported without room. The server solves one request at a time,
  because a solve blocks its thread. A request still waiting when a newer one comes is dropped: the dialog asks
  again on every change and keeps only the newest answer.

## Worked example

`packages/plan-data/src/rebalance.example.test.ts` runs this example with HiGHS and checks every number quoted
below. If the code changes a number, change the document in the same commit.

### The plan

The weekly budget is 6 h. The study hours are 11:00–14:00. Thursday 7 January 2027 is a holiday. The re-balance
starts on Monday 4 January, at 08:00.

| Session | Kind | Now |
|---|---|---|
| s1 | 1 h | Mon 4 Jan 11:00 |
| s2 | 1 h | Tue 5 Jan 11:00 |
| s3 | 1 h | Wed 6 Jan 11:00 |
| s4 | lab, 2 h | Mon 18 Jan 11:00–13:00 |
| s5 | 1 h | Tue 19 Jan 11:00 |
| s6 | 1 h | Wed 20 Jan 11:00 |

Another calendar, Talks, holds 12:00–13:00 on Tue 5 Jan and Tue 12 Jan. The course does three sessions, stops
for a week and a half, then crams 4 h into three days. That is the gap and the crunch a re-balance exists to
remove.

### Step 1: the room

| `d` | Day | Free | `cap_d` | Lab block |
|---|---|---|---|---|
| 1 | Mon 4 Jan | 11:00–14:00 | 3 | yes |
| 2 | Tue 5 Jan | 11:00–12:00, 13:00–14:00 | 2 | no |
| 3 | Wed 6 Jan | 11:00–14:00 | 3 | yes |
| | Thu 7 Jan | holiday | | |
| 4 | Fri 8 Jan | 11:00–14:00 | 3 | yes |
| 5 | Mon 11 Jan | 11:00–14:00 | 3 | yes |
| 6 | Tue 12 Jan | 11:00–12:00, 13:00–14:00 | 2 | no |
| 7 | Wed 13 Jan | 11:00–14:00 | 3 | yes |
| 8 | Thu 14 Jan | 11:00–14:00 | 3 | yes |
| 9 | Fri 15 Jan | 11:00–14:00 | 3 | yes |

The weekends are not study days, because the course uses none. The sessions' own slots count as free, which is
why Monday 4 still has three hours. Each talk takes an hour of its week's budget. The weeks of 4 and 11 January
have `fixed_w = 1` and `left_w = 5`; the week of 18 January has 6.

### Towards a deadline of Friday 15 January

**Earliest days.** The pass without a gap puts:

- s1, s2 and s3 on Mon 4, which then holds its 3 h;
- s4 on Wed 6. Tuesday has no two-hour block, and the week now holds 5 h of its 5;
- s5 and s6 on Mon 11.

Every session can be before the deadline, so the program is built only on the 8 study days before 15 January.

**Targets.** The course starts on Mon 4, `d = 1`, and from there the rhythm can run slowest, so it starts there. With
a gap `g`, the sessions aim at `d = 1, 1 + g, …, 1 + 5g`, each rounded down. s6 must land by `d = 8`, Thu 14, so
`5g` must stay under 8: `g` must stay under 1.6. Halving finds the gap just below it:

| Session | Aim `1 + k · g` | Rounded down | Day | Fits |
|---|---|---|---|---|
| s1 | 1 | 1 | Mon 4 | its own slot |
| s2 | ≈ 2.6 | 2 | Tue 5 | its own slot |
| s3 | ≈ 4.2 | 4 | Fri 8 | the week holds 3 h of its 5 |
| s4 | ≈ 5.8 | 5 | Mon 11 | a lab block |
| s5 | ≈ 7.4 | 7 | Wed 13 | |
| s6 | just under 9 | 8 | Thu 14 | the week holds 4 h of its 5 |

Every session fits on its aim, so the rhythm never has to start again.

**Levels.** Nothing is left out and nothing is late. Going over is not allowed, so level 3 is skipped. The targets
meet every row, so the rhythm costs 0 there and more anywhere else. The heaviest week (5 h: the week of 11
January, 4 h of the course and the talk), the heaviest day (2 h, the lab) and the levels after them change nothing.

**Step 3.**

- s1 and s2 keep their slots, since their days stay.
- s3 lands on a Friday, where the course has no usual start, so it takes the free slot nearest the start of the
  study hours: 11:00.
- s4 takes the calendar's usual Monday start, 11:00.
- s5 takes the usual Wednesday start, 11:00.
- s6 lands on a Thursday, where the course has no usual start either: 11:00.

| Session | Before | After |
|---|---|---|
| s3 | Wed 6 Jan 11:00 | **Fri 8 Jan 11:00** |
| s4 | Mon 18 Jan 11:00–13:00 | **Mon 11 Jan 11:00–13:00** |
| s5 | Tue 19 Jan 11:00 | **Wed 13 Jan 11:00** |
| s6 | Wed 20 Jan 11:00 | **Thu 14 Jan 11:00** |

**Report.** 4 sessions move, and the course ends on 14 January instead of 20 January. The heaviest week is 5 h,
the heaviest day 2 h, and nothing is late. The result is proven best, with no reasons. The gap and the crunch are
gone: a session every one or two study days, from the first day to the last one before the deadline.

### At one session every two study days

**Targets.** The rhythm starts where the course does, Mon 4, and each session aims two study days after the one
before it: `d = 1, 3, 5, 7, 9, 11`. Day 10 is Mon 18 and day 11 Tue 19.

| Session | Aim | Day | Fits |
|---|---|---|---|
| s1 | 1 | Mon 4 | its own slot |
| s2 | 3 | Wed 6 | |
| s3 | 5 | Mon 11 | |
| s4 | 7 | Wed 13 | a lab block |
| s5 | 9 | Fri 15 | the week holds 4 h of its 5 |
| s6 | 11 | Tue 19 | s5 is there now, and moves too |

The weeks hold 2, 4 and 1 h of the course, all within their room, so every session fits on its aim. The program
keeps the study days up to ten after day 11, 21 in all.

**Levels.** Nothing is left out. The targets meet every row, so the rhythm costs 0 there and more anywhere else.
The heaviest week is 5 h (the week of 11 January, with its talk) and the heaviest day 2 h. s1 is already on its
day.

**Step 3.** Each session takes the usual start of its weekday, 11:00. s2 can take Wed 6 at 11:00 because s3, the
session in that slot now, is moving too. s5 lands on a Friday, where the course has no usual start, and takes the
free slot nearest the start of the study hours: 11:00.

| Session | Before | After |
|---|---|---|
| s2 | Tue 5 Jan 11:00 | **Wed 6 Jan 11:00** |
| s3 | Wed 6 Jan 11:00 | **Mon 11 Jan 11:00** |
| s4 | Mon 18 Jan 11:00–13:00 | **Wed 13 Jan 11:00–13:00** |
| s5 | Tue 19 Jan 11:00 | **Fri 15 Jan 11:00** |
| s6 | Wed 20 Jan 11:00 | **Tue 19 Jan 11:00** |

**Report.** 5 sessions move, and the course ends on 19 January instead of 20. The heaviest week is 5 h and the
heaviest day 2 h. The result is proven best, with no reasons. No gap, no crunch, and a session every other study
day from the course's first day.

### Asking again

Re-balancing either result with the same request moves nothing.

## Changing it safely

- **A priority.** The levels are the two arrays at the end of `buildModel` (`model.ts`). Move a level, and
  update the table in [The order of aims](#the-order-of-aims). `model.test.ts` pins the first levels of each mode
  ("towards a deadline: nothing unplaced, nothing late, the least over the budget, then the rhythm", "at a pace:
  nothing unplaced, then the rhythm, …"). The worked example pins the rest: putting the heaviest week ahead of the
  rhythm in pace mode fails it. Towards a deadline, the brute-force test and "HF LLM towards a far deadline …"
  fail when the week goes ahead of the rhythm.
- **The rhythm.** `rhythmDays` and `targetDays` decide what each session aims at; their tests in `model.test.ts`
  give the rules by example. The tests under "a re-balance never makes up for lost days with a crunch" fail when a
  change brings the catch-up back.
- **A new aim.** Add its variables and rows in `buildModel`. Name them by index, so they stay valid in an LP
  file. Give them their values in `startOf`, because the first level starts from that solution and it must meet
  every row ("starts from the days the sessions aim at, or the earliest when those leave one out, meeting every
  row" checks it). Then add the level where it ranks.
- **A room rule.** Change `roomOf` and `room.test.ts`. If the rule decides where a session fits, change
  `rhythmDays` in the same way. Otherwise the earliest-day bound refuses placements the program would allow, and
  the targets aim at days the program refuses.
- **A placement preference.** Change the candidate order in `placeDay` and `placement.test.ts`. Keep the check
  that the rest of the day still fits, or a re-balance stops being stable ("asking again moves nothing").
- **Always** run `pnpm run test`. The real-plan tests ("on the generated schedule of this repository": every
  pace, far deadlines, and 16 February) show whether a change still solves within its time. If the worked example's numbers
  change, change this document in the same commit and say why in the message.
