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
| 2. Which day: the program | `packages/plan-domain/src/rebalance/model.ts` (`buildModel`, `earliestDays`) | `model.test.ts` |
| 2. Which day: the order of aims | `packages/plan-domain/src/rebalance/lp.ts` (`solveInOrder`) | `lp.test.ts` |
| 2. Which day: the solver | `packages/plan-data/src/solver.ts` (`solveLp`, HiGHS) | `solver.test.ts` |
| 3. What time | `packages/plan-domain/src/rebalance/placement.ts` (`placeDay`) | `placement.test.ts` |
| Report | `packages/plan-domain/src/rebalance/report.ts` (`reportOf`) | through `planRebalance` |
| All together | `packages/plan-domain/src/rebalance/index.ts` (`planRebalance`) | `packages/plan-data/src/rebalance.test.ts`, `rebalance.example.test.ts` |
| Server, MCP | `packages/plan-data/src/rebalance.ts`, `apps/web/src/server/reschedule.ts`, `packages/plan-data/scripts/mcp.ts` | `rebalance.test.ts` |

`plan-domain` builds the program in a neutral form (`LpModel`: variables, rows, an objective) and never imports
a solver. `planRebalance` takes a `solve` function. `plan-data` passes `solveLp`, which runs
[HiGHS](https://highs.dev) through the `highs` package (WebAssembly). The domain tests pass a fake solver, and the
`plan-data` tests pass the real one.

## Why three steps

```
request ─▶ 1. room          what the plan allows: study days, free half hours, room per day and per week
        ─▶ 2. which day     an integer program over (session, day), solved one aim at a time
        ─▶ 3. what time     the start of each session on its day, by plain preferences
        ─▶ report           the finish, the heaviest week, what moved, and why it cannot be better

   step 3 cannot fit what step 2 put on a day ─▶ that day gets less room, step 2 runs again (at most 3 rounds)
```

- **The room is rules.** Holidays, weekends, other events, the weekly budget and the study hours are facts of
  the plan, not choices, so a few plain functions with their own tests compute them.
- **Choosing the days is the hard part.** Several aims pull against each other here: order, room, budget,
  deadline, evenness, and leaving good sessions alone. A greedy pass that puts each session in the first free
  place piles sessions up at the start, or leaves a gap and then a crunch. That is exactly the result this
  feature must not give. An integer program states every aim and finds the best placement, and the solver can
  prove that it is the best.
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

`roomOf` gives the study days up to the horizon, the room on each day and in each week, and the current slot of
each moving session.

**Study days** are the weekdays. Saturday or Sunday counts only if the moving sessions already use that day. A
course studied only at weekends keeps to the weekend days it uses and never spills into weekdays. Holidays are
not study days. A day that the person's own calendar takes whole (an all-day busy block) is a day off: it is not a
study day, and the report names it.

**Horizon.** At a pace, the course needs `⌈n / perDay⌉` study days. The horizon is 1.5 times that, plus 14 days,
counted from the first day. Towards a deadline, the same count with `perDay = 1` runs from the deadline. Then a
course that does not fit before the deadline shows as late sessions on real days, not as sessions without room.
The horizon never ends more than 366 days after the first day.

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

### The earliest day of each session

Before building anything, `earliestDays` runs one greedy pass. It puts each session, in order, on the first day
from the previous session's day on where it fits. "Fits" uses the program's own rules: the day's room (or its own
day, for a session outside the study hours), one lab a day, and the week's room unless going over is allowed.

No valid placement puts any session earlier than this day. The proof is by induction. The sessions before session
`i` are each no earlier than their greedy day, and they keep their order. So on every day the greedy pass skipped
for `i`, they would leave `i` no more room than the greedy pass did. The day's own room and lab block do not
depend on the placement at all.

The program uses this bound in three ways:

- **No variable before it.** The program has no `y` for a session before its earliest day. A session with no
  earliest day at all gets no `y`, so it is left out.
- **A first solution.** The greedy placement is a feasible solution, and the solver starts its first level from it.
- **The deadline cut.** Towards a deadline, the greedy places the most sessions that can possibly finish in time.
  If it places all of them before the deadline, `beforeDeadline` builds the program only on the days before the
  deadline: being late ranks right after being left out, so no best answer uses a later day.

The greedy pass and the program must use the same rules. If they disagree, the bound is wrong and the program
refuses placements that are valid.

### Notation

Sessions are `i = 0 … n−1`, in order. Session `i` lasts `len_i` hours and takes `room_i` of a day's room (its
length rounded up to the half hour). The study days up to the horizon are `d = 1 … D`, and weeks are `w`. `H` is
the total length of the sessions. `own_i` is the day session `i` is on now.

### Variables

The names below are the names in the model and in the LP text that `solver.ts` writes. Each name uses indices,
never uids.

| Variable | Kind | Meaning |
|---|---|---|
| `y_i_d` | binary | session `i` is on day `d`. Only exists where it could be: from its earliest day on, on its own outside day, or where `cap_d ≥ room_i` and, for a lab, `lab_d` |
| `u_i` | binary | session `i` is left out (no room before the horizon) |
| `late_i` | binary | towards a deadline only: session `i` is on or after the deadline |
| `Y_i_d` | 0…1 | session `i` is on day `d` or before: a running sum of its `y` |
| `t_i` | 0…D | the index of session `i`'s day, for the last tie-break |
| `L_d` | ≥ 0 | hours of the calendar on day `d` |
| `C_d` | ≥ 0 | hours placed by the end of day `d` |
| `e_d` | ≥ 0 | distance of `C_d` from the ideal line |
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
| `sum_d` | `C_d = C_(d−1) + L_d` | hours placed so far |
| `above_d`, `below_d` | `C_d − e_d ≤ I_d`, `−C_d − e_d ≤ −I_d` | together, `e_d ≥ ∣C_d − I_d∣` |
| `week_w` | `Σ_(d ∈ w) L_d ≤ left_w (+ over_w)` | the week's room |
| `peakw_w` | `fixed_w + Σ_(d ∈ w) L_d ≤ Pw` | the heaviest week |

**The ideal line** `I_d` gives the hours that would be placed by study day `d` if the course went exactly as
asked:

- **at a pace**, `I_d = min(H, perDay · (H / n) · d)`: `perDay` sessions of average length a study day, until the
  course is done.
- **towards a deadline**, `I_d = H · min(d, K) / K`, where `K` is the number of study days before the deadline:
  a straight line to the last study day before it.

**Why running sums.** The order could be written on day indices, `t_(i+1) ≥ t_i`, which is a smaller model. But
the LP relaxation of that form (the program with the 0/1 variables allowed to take any value between) is so weak
that HiGHS could not place this repository's HF LLM course (about 35 sessions) in its time limit: most of them
were still left out when level 1 stopped. `Y_(i+1)_d ≤ Y_i_d` has three nonzeros a row, and its relaxation is tight.

For the same reason, `C_d` is written as a running sum. A sum over every `y` up to day `d` would cost about a
million nonzeros on a long horizon.

### The order of aims

The program is not solved once with a weighted sum of aims: weights would trade one aim against another, for
example one more late session for a lighter week. Instead the aims are **levels**, minimised one after another
(`solveInOrder`). Each level is solved with every level before it held at its best value. A lower aim therefore
never buys anything at the cost of a higher one, and there are no weights to tune.

| Level | Towards a deadline | At a pace |
|---|---|---|
| 1 | fewest left out, `Σ u_i` | fewest left out, `Σ u_i` |
| 2 | fewest late, `Σ late_i` | closest to the rhythm, `Σ e_d` |
| 3 | least over the budget, `Σ over_w` (only when allowed) | least over the budget, `Σ over_w` (only when allowed) |
| 4 | lightest heaviest week, `Pw` | lightest heaviest week, `Pw` |
| 5 | lightest heaviest day, `Pd` | lightest heaviest day, `Pd` |
| 6 | closest to the even line, `Σ e_d` | most sessions on their own day, `−Σ_i y_i_(own_i)` |
| 7 | most sessions on their own day, `−Σ_i y_i_(own_i)` | earliest days, `Σ t_i` |
| 8 | earliest days, `Σ t_i` | — |

What the order means:

- **Towards a deadline**, the course first finishes in time as far as the room allows. Then it takes the gentlest
  load that still does that: the heaviest week first, then the heaviest day. Within that load, it keeps as close
  to an even line to the deadline as it can.
- **At a pace**, the rhythm asked for comes first. The load is then as light as that rhythm allows.
- **Going over the budget**, when allowed, serves only what was asked. Towards a deadline, it is used only as far
  as it saves sessions from being late. At a pace, it is used only as far as it keeps the rhythm. It ranks right
  after those aims, so it is never used for anything else.
- **Staying put** comes after every aim of the result. A session that is already in a good place keeps its day,
  and step 3 then keeps its time.
- **The earliest days** settle what is still tied.

A level with no terms (going over, when it is not allowed) is skipped.

Each level's bound is its best value plus `10⁻⁶ · max(1, |value|)`. Without that slack, a value that the solver
met within its own tolerance would make the next level infeasible.

**Time.** Each level has **2 seconds**. It starts from the solution of the level before it, and level 1 starts
from the greedy placement. That start meets every bound so far, so a level stopped by its time limit always keeps
a solution at least as good as the start. The result is then marked as not proven best, with the largest gap the
solver reported. If a later level fails outright, the result of the levels before it stands, also marked as not
proven.

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
| `limit` | other sessions find no room before the horizon | "Some sessions find no room within a year: widen the study hours or allow going over the budget." |
| `not-proven` | a level stopped at its time limit | "The search stopped at its time limit, so a better placement may exist." |

While any session is without room, the dialog's Apply stays off. The dialog also lists the rule warnings that
`previewUpdate` gives for the resulting `events.move`.

## What "balanced" guarantees

Every guarantee below holds whenever the result is proven best. The last column names the test that checks it.

| Guarantee | Why it holds | Test |
|---|---|---|
| **Order**: the sessions keep their order, and only the end of the course can be left out | `order`, `tail`, and step 3 placing a day's sessions in order | generated plans, `model.test.ts` |
| **Room**: no session on another busy event, a holiday, a day off, a weekend the course does not use, busy time of the connected calendar, a slot that has passed, or outside the study hours (except its own slot there) | step 1, and step 3 placing only on free slots | `room.test.ts`, "never on another busy event, …" |
| **Budget**: no week over the budget unless allowed. When allowed, going over is used only as far as it serves the aim | `week_w`, and level 3 after the aim | generated plans, `model.test.ts` |
| **Deadline**: every session before it whenever the room allows | level 2 towards a deadline, right after the left-out count | "towards a deadline, against every possible placement" |
| **Gentlest load**: towards a deadline, no valid placement that finishes as well has a lighter heaviest week | level 4 | the brute force over every placement on small cases |
| **Rhythm**: at a pace, the sessions follow the line asked for as closely as the room allows | level 2 at a pace | "at half a session a day the sessions are two study days apart" |
| **Stability**: asking the same again moves nothing; sessions already in a good place keep their day and time | the own-day level, and step 3 keeping a slot whose day stays | "asking again moves nothing", the worked example |
| **Determinism**: the same question gives the same answer | the earliest-days level, and HiGHS being deterministic on the same model | "the same answer comes twice" |

## What it does not do

- **Other calendars never move**, and nor does anything else outside the moving sessions. To make room in
  another course, re-balance that course too.
- **Lengths never change.** Sessions are not split or merged. Catch up's options work with lengths.
- **Reviews and finished sessions stay**, and so do sessions before the first day.
- **2 seconds a level.** A large course at a slow pace can stop a level at its limit. On this repository's plan,
  HF LLM (about 35 sessions) at one every two study days does: the result is valid and the dialog says it may not be
  the best. Towards 16 February, the same course is proven best in about 1.5 s.
- **Determinism ends at the time limit.** A level stopped by the clock depends on how far the solver got, so two
  asks can then differ. The `not-proven` reason says when this applies.
- **Step 2 counts hours, not shapes.** Free time in pieces can refuse a session that the day's hours would hold.
  Three rounds usually settle this. What still does not fit is reported, never forced in.
- **The person's calendar is read when asked.** If it does not answer, its busy time is unknown and treated as
  free. The person's own calendar is never written to.
- **Limits.** At most 300 sessions and 366 days. A larger request is refused with a message. The server solves one
  request at a time, because a solve blocks its thread.

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

**Earliest days.** The greedy pass puts:

- s1, s2 and s3 on Mon 4, which then holds its 3 h;
- s4 on Wed 6. Tuesday has no two-hour block, and the week now holds 5 h of its 5;
- s5 and s6 on Mon 11.

Every session is before the deadline, so the program is built only on the 8 study days before 15 January.

**Levels 1–2.** Nothing is left out and nothing is late. Going over is not allowed, so level 3 is skipped.

**Level 4, the heaviest week.** The course is 7 h and its sessions keep their order. So the week of 4 January
holds the first few sessions and the week of 11 January holds the rest. The first week can hold 0, 1, 2, 3, 5, 6
or 7 h of the course. Only 3 h keeps both weeks within 5 h, counting the hour of talks in each. So `Pw = 5`: s1–s3 go
in the first week, s4–s6 in the second.

**Level 5, the heaviest day.** The lab alone is 2 h, so `Pd = 2`. From here on, no day holds more than two hours.

**Level 6, the even line.** The line is `I_d = 7d/8`:

| `d` | Day | `I_d` | `C_d` | `e_d` |
|---|---|---|---|---|
| 1 | Mon 4 | 0.875 | 1 | 0.125 |
| 2 | Tue 5 | 1.75 | 2 | 0.25 |
| 3 | Wed 6 | 2.625 | 3 | 0.375 |
| 4 | Fri 8 | 3.5 | 3 | 0.5 |
| 5 | Mon 11 | 4.375 | 5 | 0.625 |
| 6 | Tue 12 | 5.25 | 5 | 0.25 |
| 7 | Wed 13 | 6.125 | 6 | 0.125 |
| 8 | Thu 14 | 7 | 7 | 0 |

The total is 2.25, and no other placement that meets levels 1–5 comes this close. For example, the lab on
Wed 13 would leave `C_5 = C_6 = 3`, more than a full hour under the line on both days. The best placement is
unique, so levels 7 and 8 change nothing. s1–s3 are already where the line wants them.

**Step 3.**

- s1–s3 keep their slots.
- s4 takes the calendar's usual Monday start, 11:00.
- s5 takes the usual Wednesday start, 11:00.
- s6 lands on a Thursday, where the course has no usual start, so it takes the free slot nearest the start of the
  study hours: 11:00.

| Session | Before | After |
|---|---|---|
| s4 | Mon 18 Jan 11:00–13:00 | **Mon 11 Jan 11:00–13:00** |
| s5 | Tue 19 Jan 11:00 | **Wed 13 Jan 11:00** |
| s6 | Wed 20 Jan 11:00 | **Thu 14 Jan 11:00** |

**Report.** 3 sessions move, and the course ends on 14 January instead of 20 January. The heaviest week is 5 h,
the heaviest day 2 h, and nothing is late. The result is proven best, with no reasons. The crunch has moved
forward and is spread out. The first three sessions did not move, because they were already in place.

### At one session every two study days

**Horizon.** Six sessions at one every two study days need 12 study days. The horizon is ⌈1.5 × 12⌉ + 14 = 32
days, which is up to Thursday 4 February, or 23 study days.

**Level 1.** Nothing is left out.

**Level 2, the rhythm.** The line is `I_d = min(7, ½ · 7/6 · d) = min(7, 7d/12)`. Over a rising line, the
distance is least when the count of placed hours steps up on the first day the line passes the middle of the
step:

| Session | Hours placed before → after | Middle | First `d` with `I_d` past it | Day |
|---|---|---|---|---|
| s1 | 0 → 1 | 0.5 | 1 (0.58) | Mon 4 |
| s2 | 1 → 2 | 1.5 | 3 (1.75) | Wed 6 |
| s3 | 2 → 3 | 2.5 | 5 (2.92) | Mon 11 |
| s4 | 3 → 5 | 4 | 7 (4.08) | Wed 13 |
| s5 | 5 → 6 | 5.5 | 10 (5.83) | Mon 18 |
| s6 | 6 → 7 | 6.5 | 12 (7) | Wed 20 |

Every one of these days has room, and the weeks hold 2, 3 and 2 h of the course, all within their room. So
this is the best placement for the rhythm, with a total distance of `46/12 ≈ 3.83`. No line value falls exactly on
a middle, so the best placement is unique.

**Levels 4–7** follow from it: the heaviest week is 4 h (the week of 11 January, with its talk) and the heaviest
day 2 h. s1 and s6 are already on their days.

**Step 3.** Every session takes the usual start of its weekday, 11:00. s2 can take Wed 6 at 11:00 because s3, the
session in that slot now, is moving too.

| Session | Before | After |
|---|---|---|
| s2 | Tue 5 Jan 11:00 | **Wed 6 Jan 11:00** |
| s3 | Wed 6 Jan 11:00 | **Mon 11 Jan 11:00** |
| s4 | Mon 18 Jan 11:00–13:00 | **Wed 13 Jan 11:00–13:00** |
| s5 | Tue 19 Jan 11:00 | **Mon 18 Jan 11:00** |

**Report.** 4 sessions move, and the course still ends on 20 January: at this pace, the twelfth study day is
where it ended anyway. The heaviest week is 4 h and the heaviest day 2 h. The result is proven best, with no
reasons. Same finish, no crunch, and a session every other study day.

### Asking again

Re-balancing either result with the same request moves nothing.

## Changing it safely

- **A priority.** The levels are the two arrays at the end of `buildModel` (`model.ts`). Move a level, and
  update the table in [The order of aims](#the-order-of-aims). `model.test.ts` pins the first levels of each mode
  ("towards a deadline: nothing unplaced, then nothing late, then the least over the budget", "at a pace:
  nothing unplaced, then the rhythm, …"). The worked example pins the rest: putting the heaviest week ahead of the
  rhythm in pace mode fails it. The brute-force test pins the gentlest week towards a deadline.
- **A new aim.** Add its variables and rows in `buildModel`. Name them by index, so they stay valid in an LP
  file. Give them their values in `startOf`, because the first level starts from that solution and it must meet
  every row ("starts from the earliest placement, which meets every row" checks it). Then add the level where it
  ranks.
- **A room rule.** Change `roomOf` and `room.test.ts`. If the rule decides where a session fits, change
  `earliestDays` in the same way, or the bound will refuse placements the program would allow.
- **A placement preference.** Change the candidate order in `placeDay` and `placement.test.ts`. Keep the check
  that the rest of the day still fits, or a re-balance stops being stable ("asking again moves nothing").
- **Always** run `pnpm run test`. The real-plan test ("HF LLM from 4 January finishes before 16 February within
  the weekly budget") shows whether a change still solves within its time. If the worked example's numbers
  change, change this document in the same commit and say why in the message.
