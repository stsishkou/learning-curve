# Time off: how the plan should know about days off, holidays, vacations and busy hours

Researched 2026-11-25 (Europe/Minsk), at commit `faf8904` with the uncommitted `edits.json` and `plan.json` of the
working tree. The code was read first. Behaviour was measured with read-only probes: vitest files in the session's
scratchpad that import `@lc/plan-domain` from its source and work on the fixture plan, which `fixtures.ts` builds in
memory with `buildPlan(DEFAULT_CONFIG, '2026-11-22')` and every session before Wednesday 2026-12-02 12:40 marked done.
The owner's files in `packages/plan-data/data/` were read for counts only. Nothing in the repository was written
except this note, `pnpm run plan` was not run, no MCP tool that writes was called, and no plan data went into a web
query. Outside claims come from the owner of each standard, API, product or law (sections 5–8). They were read on
2026-11-25 with WebFetch, and raw API and `.ics` answers were fetched with curl. Every value in the UI sketches is
invented, to show the form.

The question: the plan needs to know when the person does not study. That covers a day off, a public holiday, a
vacation of several days, and busy hours, both recurring ones (work, a weekly meeting) and one-off ones (an
appointment, half a day away). How should the planner store them, and how should the plan react? That means shifting
or re-balancing the sessions, the weekly budget, and the forecast of the finish.

Legend: **measured** = observed by running the code on 2026-11-25; **inferred** = my derivation or design;
**(d)** = documented on the linked source, read here; **(f)** = fetched and observed (a raw API or `.ics` answer);
**(s)** = the source could not be read, the claim comes from a search snippet or a secondary copy. Code claims cite
`path:line`. A path is shortened to the file name when the name is unique:
- files of `packages/plan-domain/src/`, with `room.ts`, `request.ts` and `report.ts` in its `rebalance/`;
- `mcp.ts` and `build-plan.ts` in `packages/plan-data/scripts/`;
- `.tsx` files in `modules/planner/src/`, except `WeeklyLoad.tsx`, which is in `modules/dashboard/src/`;
- `describe-step.ts` in the planner's history feature.

The three files named `busy.ts` are always given in full.

## 1. Recommendations, ranked

**Today the plan knows four days off and cannot learn a fifth** (3.1). It also counts the weekly budget three
different ways (3.3) and does not know about time off at all when it forecasts the finish (3.5). The guide tells a
model to handle a day off with a shift that sends every later Friday session to a Saturday (3.4). So the order
below starts with what a day off *is* to the plan, then what happens to the sessions on it, then busy hours, then
what time off does to capacity and the forecast. Public holidays come last; they become one more source of days off
once the first change exists.

**Prerequisite: fix the edits reader first.** An added deadline is lost at the next save (3.6, measured). Anything
that adds all-day or new-kind events through `event.add` would hit the same reader.

### 1.1 Five recommendations, ranked

| # | Recommendation | Question it answers | New kinds of edit | Size (inferred) |
| --- | --- | --- | --- | --- |
| 1 | **Days off as plan data**: a named list of days without study that every rule already reads | Which days have no study? A day off, a vacation, a holiday | `days.off`, `days.on` | M |
| 2 | **Slide past days off**: the catch-up "push", usable for a day planned ahead | What happens to the sessions already on those days? | `events.slide` | S |
| 3 | **Busy time that is not study**: `kind: 'personal'` on new events, one budget rule, warnings both ways | How do recurring and partial-day busy hours block time without counting as study? | `kind: 'personal'` on `event.add` / `events.add`; later `UNTIL` | S–M |
| 4 | **Capacity follows days off**: a week's budget shrinks with its study days; the forecast pours work only into study days | Does a day off lower the week's budget? How do the forecast and the finish range count lost time? | none: derived | M |
| 5 | **Public holidays from a source, ticked by the person** | Where do holidays come from, and how are they kept? | none beyond #1 | S |

The decisions on the open points, in one place:

| Case | Decision | Where |
| --- | --- | --- |
| One day off | `days.off` for that day; the person picks what happens to its sessions | #1, #2 |
| Public holiday | a day off with a name, from a list the person ticks; the four in the config stay | #1, #5 |
| Vacation of several days | one `days.off` with `from` and `to` | #1 |
| Recurring busy hours | a weekly repeat of `kind: 'personal'`: blocks time, never counts | #3 |
| Partial-day busy time | a one-off `kind: 'personal'` event: blocks its hours, never counts, does not lower the budget | #3, #4 |
| Sessions already on those days | never moved silently. The preview lists them, and the person picks slide (default), re-balance or leave | #1, #2 |
| Does a day off lower the week's budget? | **yes**, in proportion to the weekdays left: 12 h × 3 ⁄ 5 = 7 h (rounded down to the half hour) with two days off. Going over stays possible, with a warning | #4 |
| Forecast and finish range | lost days are lost capacity: sessions on days off are not counted as time ahead, and overflow weeks give only their reduced budget | #4 |

### 1.2 #1 Days off as plan data

**What.** The person marks one day or a range as a day off, with an optional name ("Отпуск", "Новый год"). The plan
keeps it as data on its calendar of study days, not as an event. Every reader that respects `meta.holidays` today
respects it at once:

- the re-balance room (`room.ts:93`, `111`), the next free slot (`free-slot.ts:38`) and the rule warnings
  (`rules.ts:33`);
- the catch-up push (`replan.ts:102-113`), review planning (`reviews.ts:76`) and the pace count of the Reschedule
  dialog (`request.ts:110-113`);
- the grid labels (3.1).

One helper, `isDayOff(plan, day, busy?)`, also treats an all-day busy block of the person's own calendar as a day
off. That fixes correction C for the next free slot and the card's overlap note.

**Question.** Which days have no study, whatever the reason: a day off, a vacation, a public holiday?

**Why.**

- Microsoft Project keeps holidays and vacations as *exceptions on a calendar*, apart from the work. "Project
  doesn't include preset holidays, but you can add them to any calendar … On the Exceptions tab, type a Name for the
  holiday" (d, [holiday][msp-holiday]). The weekly hours go on another tab (d, [working days][msp-working]), and one
  person's vacation goes on that person's own calendar (d, [vacation][msp-vacation]). The plan is one person's, so
  its calendar is the plan.
- SkedPal marks a holiday calendar and lets each time map "ignore these holidays if you wish" (d,
  [SkedPal][skedpal-gcal]).
- Reclaim and Motion read a day off from an all-day *busy* or out-of-office event in the person's calendar (d,
  [Reclaim][reclaim-ooo], [Motion][motion-events]). The plan does that already, for the re-balance only, and keeps
  it as a second source.

Why not an all-day event in the plan (inferred):

- The plan's events are exported to the person's calendar apps (`ics.ts`, `calendar-sync.ts`).
- An all-day event here is one day long (`occurrences.ts:26-28`), and the edits reader drops added all-day events
  (3.6).
- Every rule would need a new "all-day blocks the day" branch, while `meta.holidays` already has its readers.

**Data model.**

- `PlanEdits` gains `days?: Record<string, string | null>`: day → name (`''` for none). `null` takes back a
  generated holiday, say to study on 31 December.
- `applyEdits` sets `meta.holidays` to the generated days without the `null` ones, plus the named ones, sorted. It
  adds `meta.dayNames?: Record<string, string>` for display. `parseEdits` reads the field.
- A range is stored as its days, at most 366 per change.

**Protocol** (`PlanChange`, `parseChange`, the JSON Schema and the guide change together, and `schema.test.ts`
fails when they drift: `schema.test.ts:27-39`, `57`):

- **`PlanChange`** (`changes.ts:49-111`):
  - `{ type: 'days.off'; from: string; to?: string | undefined; name?: string | undefined }`;
  - `{ type: 'days.on'; from: string; to?: string | undefined }`.
- **`parseChange`**: two cases that check days like `events.shift` does (`changes.ts:279-280`), `to ≥ from`, at
  most 366 days, and the name trimmed to `TITLE_MAX`.
- **`applyChange`**: writes `days`. A `days.on` for a day that is not off fails with "… is not a day off".
- **`schema.ts`**:
  - two `change(...)` entries in `CHANGES` (`schema.ts:263-439`), both in `UPDATE_CHANGE_TYPES` (`schema.ts:442-455`),
    so a chat can record "I am away 11–15 January";
  - `meta.holidays` (`schema.ts:169-173`) is described as "days without study: public holidays and the days off the
    person set", and `meta.dayNames` is added.
- **`guide.ts`**:
  - rule 2 (`guide.ts:146-147`) lists each day with its name;
  - two rows join the table of changes (`guide.ts:196-209`);
  - "Time off or a late start" (`guide.ts:252-253`) becomes: "**Time off**: `days.off` for the days, then ask the
    person what to do with the open sessions on them: slide them (`events.slide`), re-balance a course, or leave
    them. A late start: `events.shift`."
- **Warnings**: a `days.off` that lands on open sessions warns `holiday` for each of them. Today `ruleWarnings`
  checks only the events a change touched (`rules.ts:29-32`), so a new day off would warn about nothing.
  `updateOutcome` has both plans (`update.ts:133-147`) and compares `meta.holidays` before and after.
- **History**: `subjectOf` names the day off or the range (`history.ts:52-95`; `satisfies never` at `94` forces
  it). Each new kind also needs a history line in `describe-step.ts` and messages in ru, en and es.

**UI.**

- A day header menu in the week and month grids. Today no day header has one.
- "Days off…" in the command palette.
- A day off shows its name in the header, where "day off" is printed now (`WeekGrid.tsx:623`).
- The dialog:

```
Week grid, header of Thu 14 ▾                  Days off
┌───────────────────────────┐                  From [14.01.2027]  To [15.01.2027]  Name [Отпуск     ]
│ Day off                   │                  2 study days · 4 open sessions on them
│ Days off from here to…    │      ──▶         What to do with them:
│ Reschedule from this day… │                   (•) Slide them and everything after — plan ends 11 Mar (was 9 Mar)
└───────────────────────────┘                   ( ) Re-balance a course from 14 Jan… (opens Reschedule)
                                                ( ) Leave them (each shows a warning)
                                               Week of 11 Jan: budget 12 h → 7 h
                                                                                [Cancel] [Save]
```

### 1.3 #2 Slide past days off

**What.** A change that moves the open sessions sitting on days off, and every later session of the same calendars.
It refills the days of the plan that hold open sessions, in order, leaving out the days off, and extends the end in
the rhythm of the last week. This is the catch-up push (`replan.ts:90-125`) with "on a day off" in place of "missed".
It keeps the course order and each day's hours, never lands on a weekend the plan does not use, and the plan ends as
many session days later as were lost.

**Question.** What happens to the sessions already on those days, with the person deciding?

**Why.**

- Measured (3.4): a one-day `events.shift` gives 12 `weekend` warnings. The push gives none for the same lost
  Thursday, and the plan ends one day later.
- Products differ on who decides.
  - Motion moves tasks itself: "Tasks reschedule automatically if new meetings or conflicts arise" (d,
    [Motion][motion-behind]).
  - Reclaim "will automatically skip or reschedule Habits, Tasks, and Smart 1:1s" around an out-of-office event (d,
    [Reclaim][reclaim-ooo]).
  - Sunsama asks: its "Overcommitted?" prompt offers Schedule anyway, Schedule another day, Defer or Cancel, and
    "Meetings and other calendar events are never moved" (d, [Sunsama][sunsama-ts]). Its users ask for a vacation
    mode that would "roll to the day you get back" (590 votes, no status; d, [roadmap][sunsama-vac]).
- Here the person decides, as everywhere else in this plan: a change is previewed, and rules warn rather than refuse
  (`rules.ts:7-10`). The plan is also written to calendar apps, so a silent move is a silent edit in each of them;
  the sync note already keeps moves made there as proposals for the same reason
  (`docs/calendar-sync-research.md:187-188`).
- Project's model agrees on the effect: a holiday is scheduled around, "usually by lengthening the number of days it
  will take to complete the task", while duration counts only working time (d, [holiday][msp-holiday],
  [duration][msp-duration]). The slide keeps the work and lengthens the calendar.

**Protocol.**

- **`PlanChange`**: `{ type: 'events.slide'; from: string; calendars?: string[] | undefined }`.
- **`applyChange`**: reduces it to one `event.patch` per session, as `events.shift` does (`changes.ts:551-572`). It
  fails with "No sessions on days off from …" when none sits on one.
- **`parseChange`**: `from` and `calendars` as in `events.shift` (`changes.ts:279-289`).
- **`schema.ts`**: one entry: "Moves the open sessions that sit on days off from `from` on, and every later session
  of the same calendars, to the next days that hold sessions, keeping their order and hours; the plan ends later.
  Use it after `days.off`, when the person chose it." It is added to `UPDATE_CHANGE_TYPES`.
- **`guide.ts`**: a row in the table, and the "Time off" bullet of #1.
- **`events.shift`** stays as it is, for a late start and for other hours of the day.
- **History**: like `events.shift`.

**UI.** It is the default choice of the Days off dialog (#1). Reschedule → Move gets a third choice next to "by days"
and "by hours":

```
Reschedule · Move
  Calendars [All ▾]   From [14.01.2027]
  ( ) By days [ 1 ]   ( ) By hours [ 0 ]   (•) Past the days off — 4 sessions on 14–15 Jan
  73 sessions move · plan ends 11 Mar (was 9 Mar) · no warnings
```

### 1.4 #3 Busy time that is not study

**What.**

- **(a) A new event can be personal.** `kind: 'personal'` is allowed on `event.add` and `events.add`, busy or free.
  A new event in the calendar `personal` gets it unless told otherwise.
- **(b) One rule for "counts toward the budget".** Busy, timed, not repeating, not `personal`: that is `isSession`
  (`progress.ts:25`). Both `weeklyHours` (`schedule.ts:165`) and `countsToBudget` (`occurrences.ts:50`) use it, and
  the test on the calendar's id goes. This removes corrections A and B.
- **(c) Warnings both ways.** Adding or moving a busy non-session event warns about the sessions it covers. Today
  `ruleWarnings` skips every event that is not a session (`rules.ts:32`), and with (a) a new appointment would stop
  warning.
- **(d) The new-event form** gets "Counts as: study session / busy, not study / free time" and "Repeats weekly on …".
- **(e) Later: a repeat with an end** (`UNTIL`), for a term of classes or a project at work.
- **Optional: the server's busy time in previews.** The update route and the MCP tool pass the busy blocks they can
  read to the preview, which then warns about the person's own appointments too (3.2). It is data passed in, not a
  rule in the adapters.

**Question.** How do recurring busy hours (work, a weekly meeting) and partial-day busy time (an appointment, half a
day away) block time without counting as study?

**Why.**

- Calendars separate *blocking* from *what the time is*. In RFC 5545 `TRANSP` decides only "whether or not an event
  is transparent to busy time searches" (d, [§3.8.2.7][rfc5545-transp]). Google types events as out of office, focus
  time and working location (d, [Google event types][g-events]). Graph's `showAs` has `oof` and `workingElsewhere`
  beside `busy` (d, [Graph event][ms-event]).
- Planners count only planned work against capacity. Sunsama: "Only tasks in "work" contexts count toward your
  workload threshold" (d, [settings][sunsama-settings]). Motion's capacity subtracts meetings from the hours someone
  works each day (d, [capacity][motion-capacity]).
- Here, measured: an appointment adds 1.5 h of "study" and shows up as a course (A). A weekly series in its own
  calendar adds 12.5 h to the planner's budget panel (B).

**Data model.** Nothing new is stored. `kind: 'personal'` exists (`types.ts:14`), and the edits reader keeps it
(`edits.ts:183-184`).

**Protocol.**

- **`PlanChange`**: `NewEvent.kind` (`changes.ts:37`) gains `'personal'`. It is accepted for `event.add` and
  `events.add` only, not for the sessions of `course.add` (`changes.ts:129-166`). The default at `changes.ts:378`
  becomes `event.kind ?? (event.availability === 'free' || event.calendar === 'personal' ? 'personal' : 'study')`.
- **`schema.ts`**:
  - `NEW_EVENT`'s `kind` enum (`schema.ts:216-221`, `236-245`) gains `"personal"`: "busy time that is not study: work,
    an appointment, half a day away. It blocks the time, never counts toward the budget and cannot be marked done";
  - `AVAILABILITY` (`schema.ts:56-60`) stops steering "personal things" to `free`: "`free`: optional time and
    reminders. Busy time that is not study is `"kind": "personal"`".
- **`guide.ts`**:
  - a section "How to add busy time that is not study", with one example of a one-off appointment and one of a
    weekly repeat (`schema.test.ts:27-39` checks that each example fits the schema and applies);
  - rule 1 (`guide.ts:143-145`): "Sessions count; `personal` events, free events and repeats do not";
  - the habit example (`guide.ts:93-105`) keeps `free`, as an example of optional time.
- **`UNTIL`** (later):
  - the `RRULE` pattern (`schema.ts:35-41`) and `PLAIN_WEEKLY_RULE` (`recurrence.ts:12`);
  - the expansion (`occurrences.ts:18-25`);
  - the `.ics` writer and both sync formats.

  `UNTIL` is part of RFC 5545's recurrence rule (§3.3.10, not re-read for this note); a separate step.

**UI.** The new-event form (today `EventForm.tsx:146-151` has only the "Free time" checkbox):

```
New event
  Title [Стоматолог        ]   Calendar [Личное ▾]
  Date [12.01.2027]  [15:00]–[16:30]
  Counts as  (•) Busy, not study   ( ) Study session   ( ) Free time
  Repeats    [ ] weekly on  Mo Tu We Th Fr Sa Su
  ⚠ Covers "HF LLM — … (2/3)" 15:00–16:00            [Move it to the next free slot]
```

### 1.5 #4 Capacity follows days off

**What.**

- **One function for the budget of a week.** `weekBudget(plan, monday)` = `weeklyBudgetHours` × (weekdays of that
  week that are not days off) ÷ 5, rounded down to the half hour. It is read wherever the budget is read today:
  - the preview's `overBudget` (`update.ts:136`), the re-balance room (`room.ts:119`) and the next free slot
    (`free-slot.ts:41`);
  - the forecast (`forecast.ts:38`) and the catch-up outlook (`replan.ts:68`);
  - the guide's week lines (`guide.ts:48`) and the `pnpm run plan` warning (`build-plan.ts:19`);
  - the budget panel and line, the dashboard's weekly load and the plan map (3.3).
- **The forecast pours work only into study time** (`forecast.ts:27-53`):
  - a session on a day off is not time ahead, so its hours join the work left;
  - an overflow week gives its `weekBudget`;
  - the day inside a week counts study days, not 7 calendar days (`forecast.ts:49`).

  `finishRange` uses the same pourer (`forecast.ts:212`) and follows.

**Question.** Does a day off lower that week's budget, and how do the forecast and the finish range count the time
that is lost?

**Decision: yes, in proportion.**

- Elsewhere, capacity is per working day:
  - Project's duration counts "active working time … not counting … nonworking time" (d, [duration][msp-duration]);
  - Motion's capacity starts from "the total hours someone works each day" (d, [capacity][motion-capacity]);
  - Sunsama's workload threshold is daily, with "Custom by day" (d, [settings][sunsama-settings]).
- A weekly cap that ignores a day off lets the re-balance pour the whole week into the days that remain. Measured
  (3.3): two study days left, and still 6 h of room in the budget.
- The plan's 12 h is about load (CLAUDE.md), and a week with holidays is meant to be lighter (inferred).
- Going over stays possible. Previews warn and do not refuse (`rules.ts:7-10`), and the re-balance has "May go over
  {hours} h a week" (`RescheduleDialog.tsx:300`).

Three limits (inferred):

- Weekends are not in the divisor, because they are not study days unless used (`guide.ts:146-147`). A day off on a
  Saturday changes nothing.
- Partial-day busy time takes room, not budget.
- An all-day block of the person's own calendar lowers the room only. The forecast runs in the browser without the
  busy calendar; #5's "keep as a day off" turns such a block into plan data when the person wants it counted.

**Protocol.** No new kind: the budget is derived.

- `schema.ts`: `weeklyBudgetHours` (`schema.ts:164-168`) adds "lowered in proportion in a week with days off: 12 h
  with two weekdays off is 7 h".
- `guide.ts`: rule 1 (`guide.ts:143-145`) says the same, and the week lines read "week of 2027-01-11: 3 of 7 h (2
  days off)".

**Measured basis.** Holidays over four whole months leave the forecast where it was (3.5). Two more holidays leave a
week's room budget at 6 h (3.3).

**UI.**

```
Budget panel                              Dashboard · weekly load              Forecast (dashboard)
  3 h  of 7 h                                12 ┤ ▔▔▔▔╲__╱▔▔▔▔  budget           Finish 2 Apr · likely 9 Apr
  ███░░░░                                     7 ┤      ▔▔                       counts 6 days off ahead
  12 h less 2 days off (14–15 Jan)              └──────────────                  (2 sessions on days off are not
                                                                                  counted as time ahead)
```

### 1.6 #5 Public holidays from a source, ticked by the person

**What.**

- **An "Add public holidays…" dialog**, in the palette and inside the Days off dialog.
  - The server fetches the list for one country and one year from a holiday API. That code lives in `plan-data`, as
    `busy.ts` does; the request carries only a country code and a year.
  - The dialog lists the days with checkboxes, ticks the weekdays inside the plan, and marks the ones already off.
  - The ticked ones are stored as `days.off`, one change per holiday with its name, in one update.
- **It says what no list knows**: days the government moves, a working Saturday and the weekday it frees. The person
  adds those by hand, with a link to the official source.
- **Nothing is fetched unless the person asks, and nothing is bundled.**
- **"Keep as a day off"** on an all-day block of the person's own calendar, in the week grid's all-day row, stores it
  as `days.off`. A vacation kept in a calendar app then counts toward the budget and the forecast (#4).
- **The four days in `schedule.ts:25` stay**: they shape the generated schedule (3.1).

**Question.** Where do public holidays come from, and how are they kept: fetched, bundled, or entered by the person?

**Why.**

- **Tools that schedule work leave holidays to the user.** "Project doesn't include preset holidays, but you can add
  them to any calendar" (d, [holiday][msp-holiday]). SkedPal marks a calendar as the holiday calendar (d,
  [SkedPal][skedpal-gcal]).
- **A calendar app's holiday calendar does not block time, so the busy-time route cannot carry holidays.**
  - "most company holiday calendars use all-day events that are marked free" (d, [Reclaim][reclaim-ooo]). Motion
    tells you to hide Holidays "if you don't want those blocking time" (d, [Motion][motion-calendars]).
  - Google's Belarus feed sets `TRANSP:TRANSPARENT` on all 275 events (f, [feed][g-by-ics]), and the busy reader
    drops transparent events (`packages/plan-data/src/busy.ts:43`).
- **The lists disagree with the law, and only the law has the moved days.**
  - The plan's time zone is Europe/Minsk, so Belarus was checked. Decree No. 157 makes ten days non-working (d,
    [pravo.by][by-holidays]).
  - Nager.Date returns the same ten for 2027 (f, [API][nager-by-2027]).
  - Google's feed has no Радуница (11 May) for 2027 or any later year, and mixes in observances, marked only in the
    first line of the description (f).
  - The government moves working days each year (Labour Code art. 136, d, [code][by-labour-code]). For 2027, Monday
    10 May is off and Saturday 8 May is worked (resolution No. 499 of 3 October 2026, d, [resolution][by-2027],
    [news][by-2027-news]). Neither Nager nor Google has that move (f).
  - A list bundled in the repository would need a commit every October and would still miss such moves.
- **The plan today shows the gap.**
  - The config's 2026-12-31 is not on the official list: a personal day off and three public holidays share one
    unnamed list (3.1).
  - The owner's plan has 2 h of sessions on Monday 8 March 2027, a public holiday (measured). They may be intended,
    and nothing in the plan says either way.
- **The API is versioned.** Nager's v3 API ends on 2027-01-31, and v4 renames the fields (d, [README][nager-repo];
  f). The dialog names the source and the day it was read.

**Data model and protocol.** Nothing beyond #1: the dialog produces `days.off` changes.

- `guide.ts`: "For public holidays, ask the person for the country and confirm the dates before sending `days.off`;
  holiday lists leave out days the government moves."
- The fetch is a server function in `apps/web/src/server/` over a `plan-data` module. If an MCP tool exposes the
  same list, it stays a thin adapter.

**UI.**

```
Public holidays · Belarus · 2027                          source: date.nager.at, read 25 Nov 2026
 [·] Fri  1 Jan  New Year's Day                           already a day off
 [ ] Sat  2 Jan  New Year's Day                           a Saturday: nothing planned
 [·] Thu  7 Jan  Christmas Day (Orthodox)                 already a day off
 [x] Mon  8 Mar  International Women's Day                2 sessions that day
 [x] Tue 11 May  Commemoration Day (Радуница)
 …
 Holiday lists leave out days the government moves (a worked Saturday and the weekday it frees).
 Check the official list and add those here:  [ + Add a day ]                [Cancel] [Add 2 days off]
```

### 1.7 Order and size

The rank above is by value; the order of work is by what each step needs.

1. Fix the edits reader (3.6). Size S.
2. #3 (a)–(c): one budget rule and personal busy events. Size S. It removes two measured errors, and the new days
   off of #1 must not be counted against a budget that is computed three ways.
3. #1 with #2, shipped together. A day off with nowhere for its sessions to go is only half a feature. Size M.
4. #4. Size M. It touches nine readers through one function, and the dashboard's charts.
5. #5. Size S once #1 exists.
6. #3 (d), (e) and the server's busy time in previews, as the need shows.

## 2. How to do it today

What works at commit `faf8904`, without code changes. The uids and dates in the JSON are illustrative: they are the
fixture plan's. Each update below was parsed with `parseUpdate` and previewed on the fixture with no problem and no
warning (measured). Over MCP: `get_guide` first, then `get_plan` for the real uids, then `preview_update` with the
update, and `apply_update` only once the person agrees. Over HTTP, the same document goes to `POST /api/plan-update`.

### 2.1 A single day off

**In the viewer:**

- **Decided ahead, with your own calendar connected.** Integrations → busy time. Put an all-day event marked
  **Busy** on that day in your own calendar. Then open Reschedule (palette or toolbar, `build-actions.tsx:131-138`)
  → Re-balance, one course at a time, from that day, with the pace left at "Now about …". The re-balance treats the
  day as a day off and names it in its report (`room.ts:94-97`, `report.ts:73`). Three course calendars mean three
  runs. Two limits: an all-day event left as Free is dropped (`packages/plan-data/src/busy.ts:43`), and the card's
  free-slot offer and overlap note never see the day (correction C).
- **Without your own calendar.** Drag each session of that day to a free hour of the next study day *before* that
  course's next session, so the order holds. Nothing checks the order of a drag (inferred), and the week's total
  stays the same.
- **The day has already passed.** Catch up → "Push the whole plan back". Measured for one missed Thursday: 73
  sessions move, no warnings, the plan ends one day later.
- **Do not** use Reschedule → Move by 1 day for a single day: it moves every later Friday to a Saturday (12
  `weekend` warnings, measured, section 3.4).
- **The gym that day:** open the repeat and choose "Skip {date}" (`EventDialog.tsx:412-414`).

**As an update:** the day's two sessions go to Friday morning, ahead of Friday's own sessions of the same courses,
and the gym that day is skipped. `skip` replaces the whole list (`schema.ts:316-321`), so include the days already
in it.

```json
{
  "format": "learning-curve/update@1",
  "summary": "Day off on Thursday 14 January: its two sessions move to Friday 09:00 and 10:00, before Friday's own sessions, and the gym that day is skipped.",
  "changes": [
    {
      "type": "events.move",
      "moves": [
        { "uid": "hfllm-008@learning-curve", "start": "2027-01-15T09:00", "end": "2027-01-15T10:00" },
        { "uid": "hfagents-008@learning-curve", "start": "2027-01-15T10:00", "end": "2027-01-15T11:00" }
      ]
    },
    { "type": "event.patch", "uid": "personal-001@learning-curve", "patch": { "skip": ["2027-01-14"] } }
  ]
}
```

`rebalance_calendar` knows the day off only when your own calendar holds an all-day busy block on it, as in the
viewer.

### 2.2 A public holiday

**Cannot be done in the viewer or with an update.** No change kind exists (3.1), and the plan file is read-only for
a tool (`schema.ts:147`).

In the repository:

- Add the day to `DEFAULT_CONFIG.holidays` (`schedule.ts:25`), then run
  `pnpm run plan && pnpm run check && pnpm run test && pnpm run build`.
- The generated sessions are laid out again around the day. Measured for one January day: 76 generated events move
  and the plan ends a day later.
- Sessions you moved by hand keep their slots (every patch on disk has a `start`), so check those weeks afterwards
  for collisions.
- A holiday inside the certificate block can make `buildPlan` throw "Certificates do not fit"
  (`schedule.ts:84-85`). Two more days there, 28–29 December, still fit (measured).

Without touching the code, treat the holiday as a day off (2.1). The rules then will not warn about a session put on
it later.

### 2.3 A week of vacation

**In the viewer:**

- Reschedule → Move, all calendars, from the first day away, by 7 days. Measured from Monday 2027-01-11: 81
  sessions move, no warnings, and the plan ends a week later.
- A shorter absence still needs whole weeks (7, 14) to keep every session on its weekday. It leaves the days after
  the trip empty. The alternatives: the own-calendar route below, or Catch up → Push once the days have passed.
- Skip the gym on its days in the card.
- With your own calendar connected: one all-day **Busy** event over the week, then Re-balance each course from the
  first day. The report names the days off.

**As an update:**

```json
{
  "format": "learning-curve/update@1",
  "summary": "A week away from Monday 11 January: every open session from that day moves a week later and the gym is skipped that week. The plan now ends a week later.",
  "changes": [
    { "type": "events.shift", "from": "2027-01-11", "days": 7 },
    { "type": "event.patch", "uid": "personal-001@learning-curve", "patch": { "skip": ["2027-01-12", "2027-01-14"] } }
  ]
}
```

The week of the vacation keeps its 12 h budget, and the forecast does not know you are away (3.3, 3.5).

### 2.4 Recurring busy hours, and one-off busy time

**Recurring, in the viewer: cannot be done.** The new-event form has no repeat (`EventForm.tsx:94-171`). The
alternative is your own calendar's recurring events, read as busy time. The re-balance and the next free slot avoid
them, and the card names them in its overlap note. A chat's preview does not see them (3.2).

**Recurring, as an update:** `events.add` in the calendar **`personal`**, busy (leave `availability` out), with a
weekly `rrule` whose `start` falls on one of its days:

```json
{
  "format": "learning-curve/update@1",
  "summary": "A standing meeting on Tuesdays and Thursdays 15:00–16:30, as busy time that is not study.",
  "changes": [
    {
      "type": "events.add",
      "events": [
        {
          "calendar": "personal",
          "title": "Встреча",
          "start": "2026-12-01T15:00",
          "end": "2026-12-01T16:30",
          "description": "",
          "rrule": "FREQ=WEEKLY;BYDAY=TU,TH"
        }
      ]
    }
  ]
}
```

- It has to be the calendar `personal`. A busy repeat in any other calendar is counted as study by the planner's
  budget panel (correction B).
- It cannot end. When the meetings stop, remove the series with `event.remove`. Cancel single days with the full
  `skip` list.
- It blocks the re-balance and the next free slot, and a session moved onto it warns `overlap`. It does not count
  toward any budget (measured).

**One-off busy time (an appointment, half a day away): cannot be done cleanly.**

- A busy `event.add` becomes a study session (correction A).
- A `free` one blocks nothing.
- The clean route today is your own calendar. Otherwise, add a `free` reminder and move the sessions it covers by
  hand.

## 3. Ground truth from the code

### 3.1 Claim 1: "a holiday is `meta.holidays`, set in the content; no change, no update and no UI can add one"

**Confirmed, with one correction: the content does not hold them, the schedule config does.**

- The field is a flat list of days: `holidays: string[]` on `PlanMeta` (`types.ts:59`). No name, no kind, no range.
- It is set once, in `DEFAULT_CONFIG.holidays` (`schedule.ts:25`): 2026-12-25, 2026-12-31, 2027-01-01 and
  2027-01-07, and copied to the plan by `buildPlan` (`schedule.ts:153`). `content.ts` has no holidays.
  `plan.json` on disk carries the same four days (measured).
- The schedule is laid out around them: a generated session goes only on a weekday that is not a holiday
  (`schedule.ts:43-44`, `66`, `106`). So adding a day to the config and running `pnpm run plan` re-lays the
  generated sessions. Measured on the fixture: one more holiday on 2027-01-13 changes the date of 76 of the 148
  generated events, every uid keeps its title, and the plan ends a day later (2027-03-09 → 2027-03-10). A session
  whose `start` was patched keeps the patched slot, since a patch stores its own times (`changes.ts:423-436`). All 42
  patches in the owner's `edits.json` carry a `start` (measured), so those sessions would stay where they are while
  the rest move around them.
- Edits cannot carry holidays. `PlanEdits` has events, calendars, added events, the trash, a title and a countdown
  (`edits.ts:55-72`). `applyEdits` copies `meta` and changes only `planEnd`, `title` and `countdown`
  (`edits.ts:296-301`).
- No `PlanChange` names a day off (`changes.ts:49-111`), and neither does any change of the update schema
  (`schema.ts:263-439`, `442-455`). The guide states the rule ("No sessions on `meta.holidays`", `guide.ts:146-147`).
  Its table of changes has nothing to add one with (`guide.ts:196-209`).
- The viewer shows holidays and cannot change them. The week grid's day header says "day off" (`WeekGrid.tsx:599`,
  `623`). So does the month grid (`MonthGrid.tsx:94`, `120`). The year grid marks the day (`YearGrid.tsx:88`) and
  the plan map dims it (`PlanMap.tsx:105`). No day header has a menu. The new-event form has no all-day option
  (`EventForm.tsx:112-151`).
- The AI chat tab offers a "Days off" request ("From <date> to <date> I do not study. Move the sessions that are not
  done so that no week goes over the budget…", `ReaderAssistant.tsx:36`, message `ai_tpl_off_text`). The model can
  only move sessions; it cannot record the days.

### 3.2 Claim 2: busy time, and which part of the code respects which kind

**Confirmed, with three corrections (A, B, C below).**

Busy time comes from five places:

- **`availability`.** `busy` or `free` on every event (`types.ts:26-27`). `free` is written as
  `TRANSP:TRANSPARENT` (`ics.ts:123`), `transparency: 'transparent'` for Google (`google-sync.ts:99`) and
  `showAs: 'free'` for Outlook (`outlook-sync.ts:120`).
- **`kind: 'personal'`.** It means "not study at all" (`schema.ts:78-80`). It excludes the event from sessions
  (`progress.ts:25`). Only the generated gym has it (`schedule.ts:135-142`). An event added in the viewer or by an
  update gets `personal` only when it is `free`. A busy one becomes `study` (`changes.ts:376-379`), and the
  stored copy is read back the same way (`edits.ts:183-188`).
- **`rrule`.** Only `FREQ=WEEKLY;BYDAY=…`, without an end (`recurrence.ts:12`, `schema.ts:35-41`). Single days are
  dropped with `skip` (`types.ts:31-32`; the card's "Skip {date}", `EventDialog.tsx:412-414`). Repeats are expanded
  per day (`occurrences.ts:18-25`). The viewer cannot create a repeat: the new-event form has title, calendar, date,
  times, a "Free time" checkbox and notes (`EventForm.tsx:94-171`), and it sends `event.add` without `kind` or
  `rrule` (`EventDialog.tsx:239`, `244`).
- **The person's own calendar.** Its iCal address is read on the server. Repeats are expanded, and events marked
  `TRANSP:TRANSPARENT` or `STATUS:CANCELLED` are dropped (`packages/plan-data/src/busy.ts:34-73`, `43-44`). The
  result is a `BusyBlock` with an `allDay` flag (`packages/plan-domain/src/busy.ts:5-12`). It is shown behind the
  plan and never stored (`packages/plan-domain/src/busy.ts:1-4`). There is one address per plan
  (`apps/web/src/server/busy.ts:15-20`).
- **Calendar sync** (Google, Outlook) writes the plan's events out with their transparency. It reads back edits to
  those events, not the person's other events, working hours or out-of-office (`google-sync.ts:83`, `99`;
  `outlook-sync.ts:62-63`, `119-120`; no `eventType`, `workingHours` or `oof` anywhere in the repository, measured
  with `grep`).

Who respects what (each cell cites the line that decides it):

| Busy time | Re-balance room | Next free slot | Rule warnings of a preview | Overlap note in the card | Forecast |
| --- | --- | --- | --- | --- | --- |
| `meta.holidays` | not a study day (`room.ts:93`, `111`) | skipped (`free-slot.ts:38`) | `holiday` (`rules.ts:33`) | — | ignored (3.4) |
| Weekend | only if the course uses it (`room.ts:50-54`) | skipped (`free-slot.ts:38`) | `weekend` (`rules.ts:34`) | — | ignored (3.4) |
| Busy timed plan event, repeats included | blocks (`room.ts:98-101`) | blocks (`free-slot.ts:42-45`) | `overlap`, only when a *session* was touched (`rules.ts:32`, `35`) | yes (`EventDialog.tsx:216-218`) | no |
| `free` plan event | no | no | no (`occurrences.ts:42-45`) | no | no |
| All-day plan event | does not block (`room.ts:100`) | does not block (`free-slot.ts:44`) | no | no | no |
| Own calendar, timed busy | blocks (`room.ts:102`) | blocks (`free-slot.ts:46`) | **no**: the rules read the plan only (`rules.ts:35`); the MCP preview passes no busy time (`mcp.ts:88-96`) | yes (`EventDialog.tsx:219-221`) | no |
| Own calendar, all-day busy | **a day off** (`room.ts:94-97`, `112-115`), named in the report (`report.ts:73`) | **ignored** (`free-slot.ts:46`) | no | **ignored** (`EventDialog.tsx:219`) | no |
| Hours of the day | `request.hours`, one window for every day (`room.ts:89-90`, `123`) | 08:00–21:00 unless given (`free-slot.ts:34`) | — | — | — |

**Correction A: a one-off busy appointment becomes a study session.** Measured on the fixture with
`event.add {calendar: 'personal', title: 'Dentist', 2026-12-08 15:00–16:30, availability: 'busy'}`:

- It gets `kind: 'study'` and `isSession` is true.
- The week's study hours by `weeklyHours` go from 10 to 11.5.
- The planner's budget panel does not count it, because that panel skips the calendar `personal`.
- `courseProgress` lists `personal` as a course with 1 session. An `events.shift` without `calendars` moves it, and
  the forecast's remaining work grows from 123 h to 124.5 h.
- The update schema tells a model to use `free` "for optional time, reminders and personal things"
  (`schema.ts:56-60`). That is the other way to get it wrong: a `free` appointment blocks nothing, so the
  re-balance and the next free slot put sessions on top of it.

**Correction B: busy repeats count toward the planner's budget unless their calendar's id is `personal`.**
Measured: a weekly series MO–FR 09:00–11:30 in a new calendar "Работа". The planner's budget panel counts 12.5 h of
it as study in one week. `weeklyHours` counts none of it. The same series in the calendar `personal` counts 0 h in
both. In both calendars it blocks: the next free slot for a session preferring 09:00 comes out at 08:00, and moving
a session to Wednesday 10:00 gives an `overlap` warning.

**Correction C: the person's all-day busy time is a day off for the re-balance only.** The next free slot ("continue
later", the card's free-slot offer) and the card's overlap note drop all-day blocks (`free-slot.ts:46`,
`EventDialog.tsx:219`). A session can therefore be offered, or dragged, onto a day the person marked as away without
a word. The week grid does show the block in its all-day row (`WeekGrid.tsx:224`, `628-644`).

### 3.3 Claim 3: "busy timed non-repeating events count toward the weekly budget, free events and repeats do not"

**Confirmed for the preview and the guide. Corrected for the planner and the dashboard: three definitions exist.**

| Definition | What counts | Read by |
| --- | --- | --- |
| `weeklyHours` (`schedule.ts:161-172`) | busy, timed, not repeating, **any kind and calendar** | the `pnpm run plan` warning (`build-plan.ts:19-20`), the guide's week lines (`guide.ts:44-50`), a preview's `overBudget` (`update.ts:133-147`), the next free slot (`free-slot.ts:35`, `41`), the re-balance's fixed hours (`room.ts:104`, `119`) |
| `countsToBudget` (`occurrences.ts:50`) | busy, timed, **calendar not `personal`, repeats included** | the planner's budget panel and line (`BudgetPanel.tsx:21`, `BudgetLine.tsx:22`), day totals in the week, month and year grids and the agenda (`WeekGrid.tsx:264`, `MonthGrid.tsx:95`, `YearGrid.tsx:52`, `AgendaList.tsx:93`), the plan map (`PlanMap.tsx:52`) |
| `isSession` (`progress.ts:25`) | busy, timed, not repeating, **kind not `personal`** | the dashboard's weekly load (`stats.ts:30`), the catch-up outlook (`replan.ts:55-56`, which also drops the calendar `personal`), the forecast (`forecast.ts:33`, `66-69`) |

The guide's wording is right for `weeklyHours` (`guide.ts:143-145`, `schema.ts:164-168`). The two cases where the
others disagree are corrections A and B. The budget itself is the same number in every week: every reader takes
`plan.meta.weeklyBudgetHours` as it is (`update.ts:136`, `room.ts:119`, `free-slot.ts:41`, `forecast.ts:38`,
`replan.ts:68`, `BudgetPanel.tsx:25`, `BudgetLine.tsx:26`, `WeeklyLoad.tsx:30`, `PlanMap.tsx:45`). Nothing lowers
it for a week with a holiday.

Measured on the re-balance room for the course `hfllm` from 2027-01-04, study hours 11:00–14:00:

- The week of 4 January has 4 study days (7 January is a holiday) and 6 h left in its budget (6 h fixed).
- With 5 and 6 January also made holidays, it has 2 study days, and the budget left is still 6 h.
- An all-day block of the busy calendar on 12–13 January makes both days `daysOff`. Its week keeps 5 h left
  (7 h fixed).

So a day off takes room away but never budget. The re-balance may then fill the remaining days of that week with
the whole week's budget (inferred from `room.ts:116-120`).

### 3.4 Claim 4: "the guide says shift for time off; `events.shift` ignores weekends and holidays"

**Confirmed. Measured: it moves Friday sessions to Saturday.**

- The guide: "**Time off or a late start**: `events.shift` from the first affected day, then check that nothing
  landed on a holiday or a weekend and fix those with `events.move`" (`guide.ts:252-253`). The schema says the
  same: "It does not skip weekends or holidays: check where the sessions land" (`schema.ts:384`).
- `events.shift` picks every session that is not done and starts on `from` or later, in the named calendars or all
  of them (`shiftTargets`, `changes.ts:635-645`). It adds `days × 24 h + hours` to each (`changes.ts:556-566`) and
  refuses only a session that would cross midnight (`changes.ts:563-565`).
- Measured previews on the fixture:

| Shift | Sessions moved | Warnings |
| --- | --- | --- |
| all calendars, from Wed 2027-01-13, +1 day (one day off) | 76 | 12 `weekend` |
| `hfllm`, from Wed 2027-01-06, +1 day | 33 | 1 `holiday`, 7 `weekend`, 1 `overlap` |
| `certs`, from Fri 2026-12-04, +1 day | 23 | 5 `weekend` |
| all calendars, from Mon 2027-01-11, +7 days (a week away) | 81 | none |

  A whole week keeps every weekday, so it is clean. One day off is not: every Friday of the rest of the plan goes
  to a Saturday, and the guide leaves a model to repair a dozen sessions by hand.
- The plan already has the move a day off needs, but only after the fact. The catch-up "Push the whole plan back"
  scenario maps the days that hold open sessions, in order, onto the next study days. It extends the end in the
  rhythm of the last week and skips holidays (`replan.ts:90-125`, `101-114`). Measured: with Thursday 2027-01-14's
  two sessions missed, it moves 73 sessions with no warning, Thursday's go to Friday and Friday's to Monday, the plan
  ends a day later (2027-03-09 → 2027-03-10), and no week goes over the budget. It is offered only for sessions
  already missed (`replan.ts:192-196`), so it cannot be used for a day off planned ahead.

### 3.5 Claim 5: "the forecast and the weekly budget do not account for holidays"

**Confirmed. Measured: making every day of March–June 2027 a holiday does not move the forecast by a day.**

- `pourer` (`forecast.ts:22-53`) first spends the needed hours on the slots of the open sessions ahead
  (`forecast.ts:28-30`, `42-45`). A session on a day off counts as time that will be worked. The rest goes into the
  weeks after the last session, at the full weekly budget minus other courses' sessions (`forecast.ts:38`, `46-50`),
  spread over 7 calendar days (`forecast.ts:49`). It never reads `meta.holidays` or a weekday.
- So a week with two days off still offers its full weekly budget to overflow work (`forecast.ts:48`), and the
  overflow is spread over its weekend and its days off alike (`forecast.ts:49`).
- `paceForecast` and `finishRange` both use it (`forecast.ts:89`, `212`).
- Measured: 14 done sessions were logged at 90 minutes each, so the pace is ×1.5. The last planned session is on
  2027-03-09 and the forecast finish is 2027-03-24. With every day from 1 March to 30 June a holiday, the finish is
  still 2027-03-24. The finish range is 2027-04-19 for both "likely" and "late" either way; it has no width because
  every logged ratio was the same.
- The catch-up outlook counts weeks over a flat budget too (`replan.ts:68`).
- Days with nothing planned do not break the study streak (`streak.ts:22-24`), so days off already leave the streak
  alone.

### 3.6 Found on the way (outside the question)

- **A deadline added with `event.add` is lost at the next save.** The bug is measured. `applyChange` stores an added
  milestone with `kind: 'milestone'` and `allDay: true` (`changes.ts:376-387`). `parseAddedEvent` keeps neither: an
  event that is `free` becomes `personal` (`edits.ts:183-188`) and `allDay` is not read (`edits.ts:169-204`).
  `patchProblem` then refuses `end == start` (`edits.ts:247`), so the event is dropped. In the probe, one added
  milestone was in memory, and after a JSON round trip through `parseEdits` none was left. `saveChanges` starts every
  save from `readEdits()` (`packages/plan-data/src/store.ts:87-89`, `194-198`). So a deadline set in the Reschedule
  dialog for a calendar that had none (`deadlines.ts:64-77`), or by a model following guide rule 6
  (`guide.ts:156-158`), disappears at the next change (inferred from the two measured steps). The same reader would
  drop any all-day event a fix for this question adds, so it must be fixed first.
- Corrections A, B and C above are bugs in their own right.

## 4. Prior notes

- `docs/rebalancing.md:55-56` and `101-105`: the room is rules. Holidays are not study days, and "A day that the
  person's own calendar takes whole (an all-day busy block) is a day off". #1 extends that second source to the next
  free slot and the card (correction C).
- `docs/calendar-timeline-research.md:362-372`: dragging a lane is an `events.shift` by whole days. With warnings
  (budget, holidays) it opens Reschedule in Move mode. #2 adds a third way to move, past days off.
- `docs/feature-research.md:58`, `109`: the app "already has 'shift the rest by N days'". Structured's "Shift all
  events by + or - amount of time" (549 votes) is shipped there.
- `docs/llm-integration-research.md:533`, `536-539`: keep the guide's examples off `meta.holidays`, and add one
  example of `events.shift` followed by `events.move` for sessions that land on a holiday. This note replaces that
  pattern with `days.off` and `events.slide` (#1, #2).
- `docs/calendar-sync-research.md:209-215`: Google's and iCloud's public holiday feeds were fetched for their
  headers. Section 8 adds what their events say about busy time.

## 5. Prior art: calendar standards and APIs

**RFC 5545 (iCalendar)**

- `TRANSP` "defines whether or not an event is transparent to busy time searches". Its default is `OPAQUE`. Events
  that take the person's time "SHOULD be recorded as OPAQUE", and others "as TRANSPARENT, making them invisible to
  free/busy time searches" (d, [§3.8.2.7][rfc5545-transp]).
- An all-day event (a `DATE`-valued `DTSTART`) gets no other default. The RFC's own all-day examples set
  `TRANSP:TRANSPARENT` explicitly (d, [§3.6.1][rfc5545-event]).
- `FBTYPE` has `FREE`, `BUSY` (the default), `BUSY-UNAVAILABLE` ("busy and … can not be scheduled") and
  `BUSY-TENTATIVE` (d, [§3.2.9][rfc5545-fbtype]). `FREEBUSY` lists intervals in UTC (d, [§3.8.2.6][rfc5545-fb]).
  `VFREEBUSY` is a request, a reply, or "a published set of busy time information" (d, [§3.6.4][rfc5545-vfb]).
- Inferred mapping:
  - a day off is `BUSY-UNAVAILABLE`;
  - a session and a personal appointment are both `BUSY`, so the standard has no "counts as study";
  - `availability: 'free'` is `TRANSPARENT`.

  The plan therefore needs `kind` for what the time *is*, as #3 says.

**RFC 7953 (VAVAILABILITY)**

- Inside its period a `VAVAILABILITY` is `BUSY-UNAVAILABLE`, "except for any time periods corresponding to
  "AVAILABLE" subcomponents". Those can repeat (d, [§3.1][rfc7953-31]).
- `BUSYTYPE` defaults to `BUSY-UNAVAILABLE` (d, [§3.2][rfc7953-32]).
- On priorities: 0 or none is the lowest, "0, 9, 8, … 1" is the order, and a higher one overrides (d,
  [§4][rfc7953-4]).
- Free time is computed in two steps: "first the available time is calculated … Once that is done, regular "VEVENT"
  and "VFREEBUSY" components can be "overlaid" in the usual way to block out time" (d, [§5][rfc7953-5]).
- The re-balance room works in the same order. The study hours are the available window, and busy events are laid
  over it (`room.ts:98-125`, inferred). Stored study hours per weekday would be the plan's own `VAVAILABILITY`. They
  are not recommended now: one window serves, and the dialog derives it (`request.ts:24-41`).

**Google Calendar**

- **Event types and transparency.**
  - `eventType` is `default`, `birthday`, `focusTime`, `outOfOffice`, `workingLocation` or `fromGmail`, and "cannot
    be modified after the event is created".
  - Out-of-office and focus time carry `autoDeclineMode` and a `declineMessage`.
  - `transparency` is `opaque` by default ("The event does block time").

  (d, [events][g-events])
- **Limits on those types.** They are "only available on primary calendars", and "Out of office events cannot be
  all-day events". The guide sets out-of-office and focus time opaque, and working location transparent (d,
  [status events][g-status]; [event types][g-types]).
- **Working hours are not in the API.** The settings resource lists twelve settings, and none is working hours (d,
  [settings][g-settings]). Working hours are a user setting for "a work or school account", with several periods a
  day (d, [help][g-working]).
- **Holiday calendars.** Holidays "are automatically added", and "Public holidays and other observances appear on
  your calendar by default". The help does not say whether they are busy (d, [help][g-holidays]). The Belarus feed
  marks them all transparent (section 8).

**Microsoft Graph**

- **`showAs`** is `free`, `tentative`, `busy`, `oof`, `workingElsewhere` or `unknown`, with no documented default
  (d, [event][ms-event]).
- **`workingHours`** is `daysOfWeek` with *one* `startTime` and `endTime` for all of them, and a `timeZone` (d,
  [workingHours][ms-workinghours]). That is the same shape as the re-balance's single `hours` window (inferred).
- **`automaticRepliesSetting`** can be `scheduled` between two moments (d, [auto replies][ms-autoreply]).
- **`getSchedule`'s `availabilityView`** codes "0= free or working elswhere, 1= tentative, 2= busy, 3= out of
  office" (d, [scheduleInformation][ms-schedule]). It "assumes the remaining time … to be free". Working hours are
  applied only by `findMeetingTimes` (d, [free/busy][ms-freebusy]).

**What this says for the plan (inferred).**

- Calendars keep *what blocks* (transparency, `showAs`, `FBTYPE`) apart from *what kind of time it is* (Google's
  event types, `oof`).
- Days off live in the person's own calendar as typed events, and in holiday calendars as free all-day events.
- The plan can read the first through the busy feed. It cannot read the second, and must hold its own list (#1, #5).

## 6. Prior art: planners and auto-schedulers

Read on each vendor's own help pages.

| Product | Working hours | A day off or vacation | What happens to work already placed | Free and all-day events | Capacity |
| --- | --- | --- | --- | --- | --- |
| Motion | named schedules, several, each task picks one (d, [guide][motion-guide]) | no help-centre feature; "Flexible Hours" change one day's hours for "personal time off, travel" (d, vendor blog, [flex][motion-flex]) | moved by the tool: "Tasks reschedule automatically"; "Events from connected calendars always override task blocks" (d, [behind the scenes][motion-behind]) | an all-day event blocks the day "unless the event is marked as Free" (d, [event types][motion-events]); hide Holidays "if you don't want those blocking time" (d, [calendars][motion-calendars]) | per person per day: "the total hours someone works each day" less meetings; an all-day event counts 8 h (d, [capacity][motion-capacity]) |
| Reclaim | Working, Meeting, Personal and Custom hours per weekday, several ranges a day (d, [hours][reclaim-hours]) | a **busy** all-day or out-of-office event; under 8 h a "Personal commitment", over 8 h a "Vacation" (d, [time off][reclaim-ooo]) | moved by the tool: it "will automatically skip or reschedule Habits, Tasks, and Smart 1:1s" (d, [time off][reclaim-ooo]) | "By default all-day events are marked as free" and do not block (d, [why][reclaim-why]) | a weekly Focus Time goal with a daily maximum; nothing on time off lowering it (d, [focus][reclaim-focus]) |
| Sunsama | a start and end per weekday, or Unavailable (d, [auto-scheduling][sunsama-ts]) | none; a "vacation / holiday / OOO" mode has 590 votes and no status (d, [roadmap][sunsama-vac]); out-of-office events are not imported (d, [FAQ][sunsama-faq]) | asks: "Overcommitted?" offers Schedule anyway, another day, Defer, Cancel; "Meetings and other calendar events are never moved" (d, [auto-scheduling][sunsama-ts]) | free and all-day events do not block (d, [auto-scheduling][sunsama-ts]; [daily planning][sunsama-daily]) | a daily workload threshold, "Custom by day"; "Only tasks in "work" contexts count" (d, [settings][sunsama-settings]; [planned and actual][sunsama-pa]) |
| Akiflow | one day start and end (d, [calendar][akiflow-cal]) | nothing in the help centre; a changelog snippet mentions days off (s) | "Calendar events are fixed. Schedule Optimizer works around them" (d, [optimizer][akiflow-opt]) | not documented | none; a time slot shows its planned total (d, [time slots][akiflow-slots]) |
| Todoist | none | Karma "days off" and "Vacation mode": "Your Karma and streaks remain intact" (d, [Karma][todoist-karma], [vacation][todoist-vacation]) | manual "Reschedule" of overdue tasks (d, [upcoming][todoist-upcoming]) | — | goals count tasks, not hours (d, [Karma][todoist-karma]) |
| SkedPal | weekly Time Maps, changeable for one week (d, [time maps][skedpal-maps]) | a calendar flagged as the holiday calendar; each time map may "ignore these holidays" (d, [Google calendar][skedpal-gcal]) | "A holiday event is blocking this task" is a reason a task stays unscheduled (d, [status][skedpal-status]) | "Free appointments do not block"; all-day events come in "Sidelined" (d, [Google calendar][skedpal-gcal]) | the time map is the capacity (d, [status][skedpal-status]) |

What carries over (inferred):

1. **Days off are calendar data, not work items.** Holiday calendars, out-of-office events and Project's exceptions
   all sit beside the work. That supports #1.
2. **Holiday calendars are free.** Reclaim warns about it, Motion offers to hide them, and the Belarus feed shows it.
   A plan that reads only busy time never sees holidays, which is why #5 imports them.
3. **Who moves the work splits the field.** Motion and Reclaim move it themselves; Sunsama asks and never moves
   calendar events. A plan whose events live in other calendar apps, and which already previews every change, should
   ask. That gives #2's dialog.
4. **Where capacity exists, it is per day.** That supports #4.
5. **Streaks survive days off** in Todoist by a setting. Here they already do, because a day with nothing planned
   does not break a run (`streak.ts:22-24`). A day off with its sessions moved away keeps the streak without any
   setting.

## 7. Prior art: capacity calendars in project scheduling (Microsoft Project)

- **Four calendar types.** "There are four types of calendars in Project: base calendars, project calendars, task
  calendars, and resource calendars … These calendars all stack together to frame how work is scheduled" (d,
  [calendars][msp-calendars]). The three base calendars are Standard (8–17 with lunch), 24 Hours and Night Shift (d,
  [base calendar][msp-base]).
- **Holidays are named exceptions, entered by hand.** "Project doesn't include preset holidays, but you can add them
  to any calendar." "On the Exceptions tab, type a Name for the holiday", and set a recurrence for a yearly one (d,
  [holiday][msp-holiday]). Weekly hours live on another tab (d, [working days][msp-working]). In Project for the web
  a calendar template holds "Calendar exceptions such as non-working days" (d, [web][msp-web]).
- **A non-working day lengthens the span, not the work.**
  - "Work = Duration x Units" (d, [task type][msp-tasktype]). Duration counts "active working time … not counting
    time between split tasks or nonworking time" (d, [duration][msp-duration]).
  - Tasks are "scheduled around the holiday … usually by lengthening the number of days it will take to complete the
    task" (d, [holiday][msp-holiday]).
  - An *elapsed* duration (`7ed`) "counts all time, including non-working time" (d, [duration format][msp-elapsed]).
  - No single Microsoft page says "work and duration stay, the finish moves". That follows from the three quotes.
- **One person's vacation goes on that person's calendar.** Tasks assigned to them "will now be scheduled around the
  vacation" (d, [vacation][msp-vacation]). With a task calendar as well, a task gets "the overlapping working time of
  the two calendars" (d, [behind the scenes][msp-behind]). A task calendar replaces the project calendar (d, [task
  calendar][msp-taskcal]).
- **Mapping to this plan (inferred).**
  - The plan is one resource. Its calendar is the weekdays with the study hours, and its exceptions are `days.off`
    (#1).
  - The weekly budget is the resource's capacity, which shrinks with its exceptions (#4).
  - `events.shift` by days moves sessions in elapsed time. `events.slide` moves them in working time (#2). Both have
    a use: a late start is elapsed, a day off is working time.

## 8. Public holiday data

- **Official source (Belarus, the plan's time zone).** Decree No. 157 of 26 March 1998 declares non-working
  ("Объявляются нерабочими днями"): 1–2 January, 7 January, 8 March, Радуница, 1 May, 9 May, 3 July, 7 November and
  25 December (d, [pravo.by][by-holidays]).
  - The government may move single working days to Saturdays (Labour Code art. 136, part six), and a day off that
  falls on a holiday is not replaced (art. 139) (d, [Labour Code][by-labour-code]).
  - For 2027 the working day moves "с понедельника 10 мая на субботу 8 мая" (resolution No. 499 of 3 October 2026,
    d, [resolution][by-2027]; [pravo.by news][by-2027-news]).
  - The 2025 resolution moved four days (d, [2025][by-2025]).
- **Nager.Date.**
  - `GET /api/v3/PublicHolidays/{year}/{countryCode}` answers without a key (f). Belarus is among the 204 countries
    (f, [countries][nager-countries]).
  - For 2027 it returns the ten official days, each `types: ["Public"]`, `global: true`. `fixed` is `false` even for
    1 January, so that field cannot be trusted (f, [BY 2027][nager-by-2027]).
  - No moved working day appears in 2025, 2026 or 2027 (f).
  - MIT licence, "PROVIDED "AS IS", WITHOUT WARRANTY" (f, [licence][nager-license]). The API page says "No Rate
    Limits" (d, [v4][nager-v4]).
  - The v3 API's end of life is 2027-01-31. v4 (`/api/v4/Holidays/{CountryCode}/{Year}` on nagerholidays.com)
    renames fields and drops `localName`, `fixed` and `launchYear` (d, [README][nager-repo]; f).
- **Google's public holiday feed for Belarus** (f, [feed][g-by-ics]):
  - 275 all-day events for 2021–2031, every one `TRANSP:TRANSPARENT`.
  - "Public holiday" and "Observance" are told apart only by the first line of `DESCRIPTION`; there is no
    `CATEGORIES`.
  - Moved days appear in part: a freed weekday as "<Name> Holiday", a worked Saturday as a "Special Working Day"
    marked as an observance. Two of 2025's four moves are missing.
  - For 2027 it lacks Радуница, the 8 May worked Saturday and the 10 May day off.
- **Fetched, bundled or entered (inferred, from the above).**
  - *Fetched on request and ticked by the person* is the only way that is both current and correct. The API knows
    the fixed days, and the person knows the moved ones and their own.
  - *Bundled* needs a commit every year and still misses moves decided in October.
  - *Read through the busy feed* does not work at all, because holiday events are transparent.
  - Each fetch tells the API only a country and a year; the plan never leaves the machine.

## 9. Open questions only the owner can answer

1. **2026-12-31** is a day off in the config but not a public holiday. Is it your own day off? With #1 it gets a name,
   and the three public holidays get theirs.
2. **8 March 2027** has 2 h of sessions in the plan on disk, and it is a public holiday. Do you study that day?
3. **The divisor of the pro-rata budget** (#4): the five weekdays, as proposed, or the days the plan actually studies?
   They are the same today.
4. **A day off from your own calendar:** should an all-day busy block in your own calendar lower the budget and the
   forecast by itself, or only after "Keep as a day off" (#5, proposed)?
5. **The default for sessions on a new day off:** slide (proposed), or no default at all?
6. **Repeats with an end** (`UNTIL`, #3 e): needed now, for example for a work schedule that changes, or later?

## 10. Sources

Standards: RFC 5545 [§3.8.2.7][rfc5545-transp] · [§3.6.1][rfc5545-event] · [§3.2.9][rfc5545-fbtype] ·
[§3.8.2.6][rfc5545-fb] · [§3.6.4][rfc5545-vfb]; RFC 7953 [§3.1][rfc7953-31] · [§3.2][rfc7953-32] · [§4][rfc7953-4] ·
[§5][rfc7953-5].

APIs: Google Calendar [events][g-events] · [status events][g-status] · [event types][g-types] ·
[settings][g-settings] · [working hours][g-working] · [holidays][g-holidays]; Microsoft Graph [event][ms-event] ·
[workingHours][ms-workinghours] · [automaticRepliesSetting][ms-autoreply] · [scheduleInformation][ms-schedule] ·
[free/busy][ms-freebusy].

Products: Motion [guide][motion-guide] · [flexible hours][motion-flex] · [behind the scenes][motion-behind] ·
[event types][motion-events] · [calendars][motion-calendars] · [capacity][motion-capacity]; Reclaim
[hours][reclaim-hours] · [time off][reclaim-ooo] · [why not scheduled][reclaim-why] · [focus][reclaim-focus];
Sunsama [auto-scheduling][sunsama-ts] · [settings][sunsama-settings] · [FAQ][sunsama-faq] · [daily
planning][sunsama-daily] · [planned and actual][sunsama-pa] · [roadmap][sunsama-vac]; Akiflow
[calendar][akiflow-cal] · [time slots][akiflow-slots] · [optimizer][akiflow-opt]; Todoist [Karma][todoist-karma] ·
[vacation mode][todoist-vacation] · [upcoming][todoist-upcoming]; SkedPal [Google calendar][skedpal-gcal] · [time
maps][skedpal-maps] · [status][skedpal-status].

Project: [calendars][msp-calendars] · [base calendar][msp-base] · [holiday][msp-holiday] · [working
days][msp-working] · [Project for the web][msp-web] · [task type][msp-tasktype] · [behind the scenes][msp-behind] ·
[duration][msp-duration] · [duration format][msp-elapsed] · [vacation][msp-vacation] · [task calendar][msp-taskcal].

Holiday data: [Decree No. 157 on pravo.by][by-holidays] · [Labour Code][by-labour-code] · [2027
resolution][by-2027] · [pravo.by news][by-2027-news] · [2025 resolution][by-2025]; Nager.Date [README][nager-repo]
· [licence][nager-license] · [v4][nager-v4] · [countries][nager-countries] · [BY 2027][nager-by-2027]; [Google's
Belarus feed][g-by-ics].

Code and data: cited inline as `path:line`.

## 11. What could not be verified

- **The person's own Google calendar.** Whether its secret iCal address carries out-of-office and focus-time events,
  and with which `TRANSP`, was not checked: that needs the person's address. If they come through as busy timed
  blocks, the re-balance already avoids them. An out-of-office event cannot be all-day (section 5), so it never
  becomes a "day off" in the room.
- **Google and Microsoft docs leave gaps.** Google's help does not say whether holidays are busy; only the Belarus
  feed was observed. Graph documents no default for `showAs`.
- **Products.**
  - Motion: "Flexible Hours" was read on the vendor's blog, because the help-centre page redirects. Whether
    out-of-office lowers its capacity is not documented.
  - Reclaim: some pages are its 1.0 docs, and whether time off lowers the Focus goal is not documented.
  - Sunsama: whether an Unavailable day lowers the workload threshold is not documented.
  - Akiflow: its days-off handling is from a changelog snippet (s).
  - No product was used hands-on.
- **Project.** No single page states that work and duration stay while the finish moves; that is combined from three
  quotes. Elapsed duration was read in the Project XML schema reference, not a desktop help page.
- **Holiday data.**
  - Nager's v3 field meanings come from its answers and README, because the v3 docs now redirect to v4.
  - The Ministry of Labour's 2027 pages timed out, so the 2027 move rests on the resolution's demo text and the
    pravo.by news item.
  - Decree No. 157 was read through pravo.by's overview, not its consolidated text.
- **How the sources were read.** Web pages were read with WebFetch, which may split long sentences, so a few quotes
  are fragments of one sentence. The key lines of RFC 5545 and 7953 were checked against the raw text. Raw API and
  `.ics` answers were fetched with curl.
- **The planner itself.** The planner was not run: claims about the viewer are read from its components. The proposed
  changes were not prototyped, and the sizes are estimates.

[rfc5545-transp]: https://www.rfc-editor.org/rfc/rfc5545#section-3.8.2.7
[rfc5545-event]: https://www.rfc-editor.org/rfc/rfc5545#section-3.6.1
[rfc5545-fbtype]: https://www.rfc-editor.org/rfc/rfc5545#section-3.2.9
[rfc5545-fb]: https://www.rfc-editor.org/rfc/rfc5545#section-3.8.2.6
[rfc5545-vfb]: https://www.rfc-editor.org/rfc/rfc5545#section-3.6.4
[rfc7953-31]: https://www.rfc-editor.org/rfc/rfc7953#section-3.1
[rfc7953-32]: https://www.rfc-editor.org/rfc/rfc7953#section-3.2
[rfc7953-4]: https://www.rfc-editor.org/rfc/rfc7953#section-4
[rfc7953-5]: https://www.rfc-editor.org/rfc/rfc7953#section-5
[g-events]: https://developers.google.com/workspace/calendar/api/v3/reference/events
[g-status]: https://developers.google.com/workspace/calendar/api/guides/calendar-status
[g-types]: https://developers.google.com/workspace/calendar/api/guides/event-types
[g-settings]: https://developers.google.com/workspace/calendar/api/v3/reference/settings
[g-working]: https://support.google.com/calendar/answer/7638168
[g-holidays]: https://support.google.com/calendar/answer/13748345
[g-by-ics]: https://calendar.google.com/calendar/ical/en.by%23holiday%40group.v.calendar.google.com/public/basic.ics
[ms-event]: https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0
[ms-workinghours]: https://learn.microsoft.com/en-us/graph/api/resources/workinghours?view=graph-rest-1.0
[ms-autoreply]: https://learn.microsoft.com/en-us/graph/api/resources/automaticrepliessetting?view=graph-rest-1.0
[ms-schedule]: https://learn.microsoft.com/en-us/graph/api/resources/scheduleinformation?view=graph-rest-1.0
[ms-freebusy]: https://learn.microsoft.com/en-us/graph/outlook-get-free-busy-schedule
[motion-guide]: https://www.usemotion.com/help/time-management/auto-scheduling/auto-scheduling-how-to-guide
[motion-flex]: https://www.usemotion.com/blog/flexible-hours-in-motion
[motion-behind]: https://www.usemotion.com/help/time-management/auto-scheduling/reference-auto-scheduling/how-auto-scheduling-works-behind-the-scenes
[motion-events]: https://www.usemotion.com/help/project-management/meeting-events/reference-meeting-events/supported-event-types
[motion-calendars]: https://www.usemotion.com/help/time-management/all-things-calendars
[motion-capacity]: https://www.usemotion.com/help/project-management/capacity-planning
[reclaim-hours]: https://help.reclaim.ai/en/articles/3600766-set-your-working-meeting-personal-custom-hours
[reclaim-ooo]: https://help.reclaim.ai/en/articles/5313671-how-to-tell-reclaim-when-you-re-on-vacation-holiday-or-out-of-office
[reclaim-why]: https://help.reclaim.ai/en/articles/5903945-why-isn-t-reclaim-scheduling-something
[reclaim-focus]: https://help.reclaim.ai/en/articles/6332766-use-focus-time-to-defend-time-for-productive-work
[sunsama-ts]: https://help.sunsama.com/docs/timeboxing-auto-scheduling
[sunsama-settings]: https://help.sunsama.com/docs/user-settings
[sunsama-faq]: https://help.sunsama.com/docs/faq/faq/
[sunsama-daily]: https://help.sunsama.com/docs/usage-guides/daily-planning
[sunsama-pa]: https://help.sunsama.com/docs/usage-guides/tasks/planned-and-actual-times/
[sunsama-vac]: https://roadmap.sunsama.com/improvements/p/vacation-holiday-ooo-sick-leave-mode
[akiflow-cal]: https://product.akiflow.com/help/articles/0807758-customize-your-calendar
[akiflow-slots]: https://akiflow.featurebase.app/en/help/articles/3089241-time-slots
[akiflow-opt]: https://product.akiflow.com/en/help/articles/3161671-schedule-optimizer
[todoist-karma]: https://todoist.com/help/articles/introduction-to-karma-OgWkWy
[todoist-vacation]: https://todoist.com/help/articles/turn-on-or-off-vacation-mode-in-todoist-pAQmRp
[todoist-upcoming]: https://www.todoist.com/help/todoist/get-started/plan-your-week-with-the-upcoming-view-OKOg1mR8
[skedpal-gcal]: https://docs.skedpal.com/calendar/connecting-your-google-calendar
[skedpal-maps]: https://docs.skedpal.com/time-maps/customizing-time-map-hours-for-each-week
[skedpal-status]: https://docs.skedpal.com/planning/scheduling-status
[msp-calendars]: https://support.microsoft.com/en-us/office/work-with-calendars-in-project-323ff403-a676-428c-be11-6942bfb7210c
[msp-base]: https://support.microsoft.com/en-gb/project/create-a-new-base-calendar
[msp-holiday]: https://support.microsoft.com/en-us/office/add-a-holiday-to-the-project-calendar-83497cbf-9b6e-4805-8603-2a89038290a0
[msp-working]: https://support.microsoft.com/en-us/project/set-the-general-working-days-and-times-for-a-project
[msp-web]: https://support.microsoft.com/en-us/office/project-calendars-in-microsoft-project-for-the-web-ea39229c-6335-4641-80ca-cf206b88b0c3
[msp-tasktype]: https://support.microsoft.com/en-us/office/change-the-task-type-for-more-accurate-scheduling-b0b969ad-45bc-4e9e-8967-435587548a72
[msp-behind]: https://support.microsoft.com/en-us/project/how-project-schedules-tasks-behind-the-scenes
[msp-duration]: https://support.microsoft.com/en-us/project/duration-task-field
[msp-elapsed]: https://learn.microsoft.com/en-us/office-project/xml-data-interchange/durationformat-element?view=project-client-2016
[msp-vacation]: https://support.microsoft.com/en-us/office/add-a-resource-s-vacation-time-8240adc0-692b-4d23-827b-a81fb560945d
[msp-taskcal]: https://support.microsoft.com/en-us/office/create-a-calendar-for-a-task-within-project-3efc5d70-92b1-485a-ad99-2f4648b4c94f
[nager-repo]: https://github.com/nager/Nager.Date
[nager-license]: https://github.com/nager/Nager.Date/blob/main/LICENSE
[nager-v4]: https://nagerholidays.com/Api
[nager-countries]: https://date.nager.at/api/v3/AvailableCountries
[nager-by-2027]: https://date.nager.at/api/v3/PublicHolidays/2027/BY
[by-holidays]: https://pravo.by/gosudarstvo-i-pravo/gosudarstvennye-prazdniki/
[by-labour-code]: https://pravo.by/document/?guid=3871&p0=hk9900296
[by-2027]: https://etalonline.by/document/?regnum=C22600499
[by-2027-news]: https://pravo.by/novosti/novosti-pravo-by/2026/october/95281/
[by-2025]: https://etalonline.by/document/?regnum=c22400839
