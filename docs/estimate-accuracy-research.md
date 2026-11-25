# Estimate accuracy: which reports show where the planned lengths were wrong

Researched 2026-11-25, 09:00–10:40 UTC (12:00–13:40 Europe/Minsk), at commit `4f0fd90` with the uncommitted
`edits.json` and `plan.json` of the working tree. The owner's data was read from the files on this machine only
(`packages/plan-data/data/`, `library/`, every committed copy in git). It was parsed by read-only scripts in the
session's scratchpad, which import `buildPlan` and `applyEdits` from `@lc/plan-domain`. Nothing in the repository was
written, `pnpm run plan` was not run, and no plan data went into a web query. Method sources are the original papers,
reports or the author's own post. Product claims come from each vendor's own help pages (section 6).

The question: the plan gives each study session a planned length, and a finished session can carry the minutes it
really took. Which reports and charts would show where those planned lengths were wrong? What took longer, what took
less, and is there a pattern by course, kind of session, length, weekday, week of the plan or over time?

Legend: **measured** = counted from the owner's data on 2026-11-25; **inferred** = my derivation, estimate or
simulation; **(d)** = documented on the linked source, read here; **(s)** = the source could not be read, the claim
comes from a search snippet or a secondary copy. Code claims cite `path:line`.

## 1. Recommendations, ranked

**Today there is nothing to analyse.** The plan has 131 sessions and **none is done** (measured). No done session,
no `actual` and no `paced` flag exists in `plan.json`, `edits.json`, `history.json`, the library file or any committed
copy (section 3). The first session starts on 2026-11-26 at 14:00. So the first job is to make the log complete and
honest. The views come second, and each must stay quiet until it has enough points (section 4).

### 1.1 Five views, ranked

| # | View | Question it answers | Data it needs | Available now? | Where |
| --- | --- | --- | --- | --- | --- |
| 1 | **Evidence count and honest pace**: per course, "logged 9 of 14 done", the pace of the logged sessions alone, and the pace as computed today | How much of each course's pace rests on logged time? | done sessions, `actual`, planned length | Yes: all inputs exist (`progress.ts:36-56`, `forecast.ts:39`) | Dashboard and Focus; the same number in the planner |
| 2 | **Ratio strip per course** on a log axis, ×1 line, one dot per logged session, geometric mean with its 95% interval from 6 points on | Which course and which kind (lab, review) run over or under, how consistently, and which sessions are outliers? | per logged session: `actual`, planned length, calendar, kind, title | Yes | Dashboard |
| 3 | **Reference-class expectation** for the session in hand: "sessions like this took ×1.25 (n 9): about 1 h 15 min", a tick on the progress bar, and after Finish this session's ratio | How long will this session probably take? | logged ratios of the same course and kind, n ≥ 6 | Yes | Focus |
| 4 | **Bias over time**: running geometric mean of the ratio per course, one small panel per course, x = logged session number | Is the error shrinking, steady or drifting as the course goes on? | logged ratios in the order they were finished | Yes; the weekly ratio already exists in the week review | Dashboard; week review |
| 5 | **Module overrun list**: modules ranked by total real hours ÷ planned hours, with sessions added to the module | Which modules (the unit the content estimated) took longer or shorter in total? | done sessions grouped by module title (`goals.ts:37-38`); the first planned length of sessions added later | Partly: grouping yes; "sessions added" needs the first estimate kept (logging L4) | Dashboard |

Not recommended now (section 7): a planned-vs-actual scatter with the y = x line (the planned lengths take only two
values, 60 and 120 minutes, measured), a histogram of the ratio, a weekday or hour heatmap (hour and month are tied to
the course, measured), a calendar heatmap, and MMRE or percent error as the headline number.

### 1.2 What to log first

In order of value per effort (details and the protocol changes in section 9):

- **L1. Time on every done session.** No protocol change: `actual` already exists. Today four paths mark a session
  done without time and only Focus logs it (section 2.2). Count unlogged done sessions apart from logged ones, never
  as "took its plan".
- **L2. Whether the time was measured or recalled.** A stopwatch total and a number typed into the card's stepper
  (which starts at the planned length, `SpentTime.tsx:21`) have different errors. This needs a new stored field.
- **L3. The real start and the paused minutes from the stopwatch.** A weekday or time-of-day pattern needs the time
  the work happened, not the slot it was planned in. The PSP time log keeps start, stop and interruption time
  ([PSP][psp] §5.1, p. 15). This needs new stored fields.
- **L4. The first planned length**, kept when a change first resizes a session. For a generated session the baseline
  already gives it (section 2.3). It matters for sessions added in the viewer and before the catch-up "pace" scenario
  resizes sessions in bulk.

Two changes need no protocol work. **Focus could log whole minutes instead of quarter hours.** The 15-minute rounding
(`FocusPage.tsx:65-66`) puts every 1-hour ratio on a grid of ×0.25, and under that grid a median stops covering the
truth as data grows (section 4.3). **The dashboard's "Pace" tile** measures schedule lead (`StatTiles.tsx:39-53`). The
"Pace" column of the forecast measures real hours per planned hour (`PaceForecast.tsx:55`, `80`). Two meanings of one
word sit on one page; rename one of them before adding views 1–5.

### 1.3 Sketches

All values in the sketches are invented, to show the form; none comes from the owner's data.

**View 1, evidence count** (a column in the existing forecast table, `PaceForecast.tsx:49-113`):

```
Course     Pace                          Left             Plan     Real
Course A   ×1.25 · logged 9 of 14        12 h → 15 h      29 Dec   3 Jan  ▼ 5 days
           ×1.16 if the 5 unlogged took their plan
Course B   —     · nothing logged yet    35 h             22 Feb   —
```

**View 2, ratio strip** (log axis; dots stack where 15-minute steps make ties; ▲ lab, ◇ review):

```
              ×0.5         ×0.75     ×1        ×1.5        ×2
                ┊            ┊        │          ┊           ┊
Course A  n 9                    •  • │••  ━━━◆━━━    •      ▲
                                      │•
Course B  n 4             •           │   •      •    •               (no summary under 6)
                                      │
              ◆ geometric mean   ━ its 95% interval   │ the plan   ┊ grid
```

**View 3, Focus** (one line under the existing "left / over" text, `FocusPage.tsx:311-315`, and a tick on the bar):

```
  ● Course A — Module 3 (2/3)
  Today, 14:00–15:00 · planned 1 h
                     38:12
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┿━━━━━━━━━
                                     ↑ typical
        22 min left · sessions like this took ×1.25 (n 9): about 1 h 15 min

  after Finish:   "Module 3 (2/3)" is done, 1 h 20 min logged · ×1.33 of the plan, typical ×1.25
```

**View 4, bias over time** (one panel per course; the courses do not overlap in time, so no shared date axis):

```
Course A                                          Course B
×1.5 ┤                                            ×1.5 ┤
     │      ●──●                                       │
×1.2 ┤ ░░░░░░░░●──●──●──●──●──●  ×1.22                 │   (from 6 logged sessions on)
×1   ┼────────────────────────── plan             ×1   ┼──────────────
     └┬─────┬─────┬─────┬─────┬─ logged #              └┬─────┬────
      6     10    15    20    25                        6     10
      ░ 95% interval of the running geometric mean, narrowing with n
```

**View 5, module list** (top three over, top three under):

```
Module                         Sessions   Planned   Logged     Ratio   Added later
Course A — Topic X               3 of 3    3 h      4 h 15     ×1.42   +1 session
Course A — Topic Y               2 of 2    2 h      1 h 30     ×0.75   —
```

### 1.4 Ten features, ranked

The rank follows what is lost by waiting. A record that is not stored on the day a session is done cannot be
rebuilt later, while a view can be built at any time over the records that exist. So the features that change what
is stored come first, then the shared model, then the views (inferred). Sizes are rough (inferred): S is a day or
less, M a few days.

1. **Stopwatch record (`session.finish`)**: logging L2 and L3.
   - What: Finish on Focus stores whole minutes, `measured: true`, `began` (first start, Minsk wall-clock) and
     `paused` (minutes stopped), instead of a quarter-hour `actual`.
   - Why: stopwatch and recalled times have different errors (2.1, correction 2). The quarter-hour grid breaks the
     median (4.3). A weekday or time-of-day view needs the real start (4.4; the PSP time log, 5.1).
   - Protocol: the app-only `PlanChange` of section 9, L2/L3. `applyChange` reduces it to an `event.patch`. In
     `parseChange`, a new case validates it, `parsePatch` reads the fields back, and `event.patch` refuses them from
     input. `schema.ts` documents the three fields on `EVENT`, keeps `CHANGES` and `UPDATE_CHANGE_TYPES` as they are,
     and keeps the `event.patch` patch closed. `guide.ts` says they are read, never sent.
   - Size M. Every session finished before it ships loses its start and pauses. The first one is on 2026-11-26.
2. **Honest pace from one accuracy model**: view 1.
   - What: `packages/plan-domain/src/accuracy.ts` gives, per course and per kind:
     - the done, logged and unlogged counts;
     - the ratio of sums, for forecasting;
     - the geometric mean of the per-session ratios with its 95% interval, for "typical" (5.3);
     - the reference class of a session: the same course and kind from 6 logged sessions, else the same kind, else
       none (5.2).
     It summarises nothing below 6 (4.1). The forecast, the course list, the week review, Focus, the new dashboard
     cards and the AI tools all read this one function.
   - Why: today an unlogged done session enters the pace as ×1 in three places, with no count beside it, and drives
     the catch-up "pace" scenario (2.2).
   - Protocol: none. Size M.
3. **"Not finished, continues next time"**: question 10.4.
   - What: a done session can carry `unfinished: true`, meaning the hour was spent but the module's "Done:" goal was
     not met. The card and Focus's Finish offer it next to the time. A continuation session is added through the
     existing add flow.
   - Why: the module is the real unit of estimate. Without this flag, a session that runs out of time logs ×1 and the
     module's overrun stays hidden (5.3).
   - Protocol: `event.patch` gains `unfinished?: boolean`. Unlike the stopwatch fields, a person or a chat may send it
     ("I didn't get through it"). `parsePatch` validates it, and it is dropped wherever `done` drops `actual`
     (`edits.ts:197-200`, `changes.ts:367-370`, `386`). `schema.ts` adds it to `EVENT` and to the `event.patch`
     patch. `guide.ts` gets a line under "How to give other updates": "when the goal of a session was not met, send
     `done`, `actual` and `unfinished: true`". The drift test then checks the parser and the schema agree.
   - Size M.
4. **First estimate kept**: logging L4.
   - What: `applyChange` sets `estimate` (minutes) the first time a change resizes a session and never overwrites it.
     The parts of a split carry `from`, the uid they came from.
   - Why: history cannot recover a first estimate (2.3). Sessions added in the viewer and paced sessions lose it.
   - Protocol: no new kind. `parseChange`'s `event.patch` refuses `estimate` and `from`, and `parsePatch` reads them
     from `edits.json`. `schema.ts` documents both as read-only on `EVENT`, and the patch stays closed. `guide.ts`
     gets a line beside rule 5 (`guide.ts:150-151`).
   - Size S–M.
5. **Focus: "sessions like this took ×1.25 (n 9)"**: view 3.
   - What: one line under "left / over", a tick on the existing bar, and after Finish this session's ratio next to
     the typical one. It appears from 6 logged sessions in the reference class (sketch in 1.3).
   - Protocol: none. Size S once feature 2 exists.
6. **Ratio strip card**: view 2.
   - What: a dashboard card after the forecast. Each course gets a row of dots on a log axis, with the ×1 line and
     kind as a shape. The geometric mean and its interval appear from 6 logged sessions. Hovering a dot names its
     session, and the card has a table twin.
   - Protocol: none. Size M.
7. **Bias over time**: view 4.
   - What: one small panel per course, with x = the logged session's number and a running geometric mean in a band
     that narrows as n grows. The week review shows its weekly ratio with n.
   - Protocol: none. Size M.
8. **Module overrun list**: view 5.
   - What: modules ranked by real ÷ planned hours, with the sessions added later and the unfinished count, in a
     collapsed `details` like the weekly table.
   - Needs features 3 and 4 for its last two columns. Protocol: none beyond them. Size S–M.
9. **A finish range instead of one date**: Evidence-Based Scheduling's Monte Carlo (5.1).
   - What: per course, the remaining planned hours are simulated with ratios drawn from that course's logged
     history: all courses below 6 logged, none below 6 in all. The forecast shows the P50 and P90 finish, and the
     burn-up draws the band.
   - The domain function takes a seed, so tests are deterministic. Ratios older than about six months drop out, as
     Spolsky advises.
   - Protocol: none. Size M; worth it from about 20 logged sessions, which `certs` reaches on 2026-12-10 (measured, 3).
10. **Accuracy for chats and tools.**
    - What: a read-only `get_accuracy` MCP tool and a `GET /api/plan-accuracy` route, as thin adapters over
      feature 2. The AI chat tab gets the same data.
    - With it, a chat can quote a course's typical ratio and n before it resizes sessions to a pace, and propose
      lengths for added sessions from the reference class.
    - Protocol: no `PlanChange` and no `schema.ts` change, because it is a read, not an update. `guide.ts` gets a
      paragraph: "before resizing sessions or proposing a length, read the accuracy and quote n; below 6 logged,
      keep the planned length". `pnpm run test` still covers the guide's examples.
    - Size S–M.

### 1.5 Ten UX/UI improvements

These make logging take less effort and the numbers harder to misread. None needs a protocol change of its own.

1. **"Done" asks for the time.** "Mark done" in the card opens the time stepper at once, and one confirm stores
   both. Today the stepper appears only after the session is done (`EventDialog.tsx:284-289`, `438-442`). This is
   logging L1.
2. **A stepper that does not start at the plan.**
   - Today it starts at the planned length (`SpentTime.tsx:21`), which pulls a recalled time towards ×1 (inferred).
   - It should start at the Focus time when there is one, and otherwise empty, with chips: "as planned · −15 · +15 ·
     +30 · +1 h".
3. **Bulk "done" asks for times too.** The overdue bar and the agenda's bulk action (`PlannerPage.tsx:419`,
   `AgendaList.tsx:175`) open a short list with a time on each row. "Not logged" is a choice the person makes, never
   the silent default.
4. **"Not logged" is visible.**
   - A done session without a time shows a hollow check in the grid and the agenda.
   - A chip, "5 done without time", on the planner and the dashboard opens a quick-fill list.
5. **Resizing a done session warns.** The grid's resize handles on a done session (`WeekGrid.tsx:811-824`) ask
   whether to change the plan or the logged time, with the logged time as the default. An update already gets this
   warning (`rules.ts:47-48`); this is question 10.5.
6. **One word for one meaning.**
   - Rename the "Pace" tile, which shows schedule lead (`StatTiles.tsx:39-53`), to "Lead".
   - "Pace" keeps real ÷ planned.
   - Every ratio reads "×1.25 · 25% longer · n 9", never as a bare percent (5.3). This is question 10.6.
7. **A finish that can be corrected.**
   - After Finish, the status line shows the logged time and its ratio, with "Adjust" and an undo for a few seconds.
   - When the stopwatch ran more than twice the plan or past midnight, Focus asks "Were you working all of this?"
     before it stores the time. A forgotten stopwatch makes exactly the outlier that moves a ratio of sums most (5.3).
8. **Breaks shown as they were.** Focus shows "worked 52 min · paused 8 min". Feature 1 keeps both numbers, so
   whether a taken break counts becomes a display choice (question 10.3).
9. **"Learning" states instead of early charts.** Each view shows "4 of 6 logged" for a course until it may
   summarise, and the Focus line stays hidden below 6 (4.1). An empty chart and a chart of two dots both mislead.
10. **Direction by position and glyph, never by colour alone.**
    - The planner's chips read "took 1 h 20 ▲" or "▼".
    - Kind is a shape.
    - Every new chart has a table twin and keyboard focus (section 7).

### 1.6 Order and the defaults taken

- **Before the first session (2026-11-26 14:00):** feature 1 and UX 1–2, so that every logged time is whole minutes,
  measured or recalled, from day one.
- **During the first week**, before `certs` has 6 logged sessions on 2026-11-30 (measured, 3): features 2–4 and
  UX 3–6.
- **From 6 logged sessions:** features 5–8 and UX 7–10.
- **From 20 logged sessions** (2026-12-10 for `certs`): feature 9. Feature 10 can follow feature 2 at any time.

The open questions in section 10 are taken at these defaults:

- Q1: show both paces with the count, and decide on the logged pace from 6 sessions on.
- Q2: log whole minutes.
- Q3: keep both numbers and show the worked time.
- Q4: yes, feature 3.
- Q5: warn, UX 5.
- Q6: rename, UX 6.

## 2. Ground truth from the code

### 2.1 Claim 1: "`actual` is a single total in minutes, 5 to 1440; pauses, the real start and interruptions are not kept"

**Confirmed, with two corrections on what values really arrive.**

- One optional number per event: `actual?: number`, "Minutes the finished session really took, when that was logged;
  otherwise it counts as planned" (`packages/plan-domain/src/types.ts:37-38`).
- The parser accepts an integer from 5 to 24 × 60 (`packages/plan-domain/src/edits.ts:76-80`). The JSON Schema says
  the same for the plan and for `event.patch` (`schema.ts:95-100`, `schema.ts:267-272`).
- It lives only on a done session. `applyEdits` deletes `actual` with `done` when `done` is false
  (`edits.ts:197-200`). `applyChange` does the same for added events (`changes.ts:367-370`) and for generated ones
  (`changes.ts:386`). An added event keeps it only with `done` (`edits.ts:125`). Un-marking a session therefore erases
  its logged time, and marking it done again does not bring the time back.
- Pauses and the real start exist only in the browser while the stopwatch runs. `{ uid, startedAt, banked }` is kept
  in `localStorage` under `learning-curve:focus` (`modules/planner/src/pages/focus/model/use-stopwatch.ts:3-12`,
  `27-34`). Finish sends `{ done: true, actual }` and then `watch.reset()` removes that state (`FocusPage.tsx:175-183`,
  `use-stopwatch.ts:72`). A taken break pauses the stopwatch (`FocusPage.tsx:338-341`), and the break's own state is
  `localStorage` too (`use-glass.ts:22`, `blocks.ts:65-74`). Nothing about interruptions reaches the plan.
- **Correction 1: the values the app writes are quarter hours, not minutes.** Focus logs
  `max(15 min, round(elapsed / 15 min) × 15 min)` (`FocusPage.tsx:65-66`, `180`). The card's stepper moves in 15-minute
  steps (`SpentTime.tsx:6`, `31-32`, `44-45`) between 15 minutes and 12 hours. Only an update from a tool or a chat
  can store 5–14 minutes, a value off the quarter-hour grid, or more than 12 hours (`guide.ts:236-237`). For a 1-hour
  session the ratio actual/planned can only be 0.25, 0.5, 0.75, 1, 1.25 and so on. For a 30-minute review
  (`reviews.ts:10`) the steps are 0.5 wide.
- **Correction 2: two different quantities share the field.** From Focus, `actual` is stopwatch time with pauses and
  taken breaks left out, though a skipped break keeps running. From the card it is a recalled number, and the
  stepper starts at the planned length (`SpentTime.tsx:21`). Nothing records which one it is.

### 2.2 Claim 2: "a session marked done with no logged time counts as if it took its planned length"

**Confirmed. The effect is wider than the claim says.**

- `spentHours` returns the planned hours when `actual` is undefined (`progress.ts:26-27`). A course's pace is
  `Σ spent ÷ Σ planned` over its done sessions (`progress.ts:40-49`), and the plan's pace is the same over all courses
  (`forecast.ts:38`). An unlogged done session therefore enters as a ratio of exactly ×1 and pulls the pace towards the
  plan. Example (inferred): 4 sessions logged at ×1.5 and 6 unlogged give `(4 × 1.5 + 6) ÷ 10` = ×1.2 instead of ×1.5.
- Four paths mark a session done without a time:
  - "Mark done" in the event card (`EventDialog.tsx:438-442`). The stepper appears only after that
    (`EventDialog.tsx:284-289`).
  - The overdue bar's bulk action (`modules/planner/src/pages/planner/ui/PlannerPage.tsx:419`).
  - The agenda's bulk action (`AgendaList.tsx:175`).
  - `events.done` from a tool or chat (`changes.ts:537-545` sends `{ done }` only). The guide's own worked example
    marks a session done this way (`guide.ts:63-67`).
  Only Focus logs time on finishing (`FocusPage.tsx:180`).
- Where the diluted pace is shown without its count:
  - the forecast's per-course "Pace" cell, shown whenever a course has a done session (`PaceForecast.tsx:80`);
  - the planner's course list, shown when it is off ×1 by 0.05 or more (`CourseProgress.tsx:40`);
  - the week review's "Time spent" tile (`WeekReviewDialog.tsx:61`, `74`).
  The count `logged` is computed (`forecast.ts:8-9`, `39`). The dashboard uses only its total, to show "Log the time
  you spent…" when it is zero (`PaceForecast.tsx:33`, `48`).
- The diluted pace also drives decisions. The catch-up "pace" scenario resizes every session ahead by it
  (`replan.ts:168-186`), and the forecast's "needed" hours use it (`forecast.ts:52`).
- So yes: unlogged done sessions must be counted and shown apart. Whether the pace should leave them out or keep them
  at ×1 is a choice (question 10.1). Leaving them out assumes they went like the logged ones. Keeping them assumes
  they matched the plan. The planning-fallacy evidence (section 5.2) makes the second assumption the weaker one.

### 2.3 Claim 3: "today's planned length may not be the first estimate; check whether history recovers it"

**Partly confirmed. History does not recover it; the generated baseline does, for generated sessions only.**

- What can change a session's length:
  - `event.patch` with a new `start` or `end` (`changes.ts:380-391`): the card or a resize in the grid. The grid
    draws resize handles on every event when editing is allowed, done ones included (`WeekGrid.tsx:811-824`), and
    `pointerDown` has no guard for done (`WeekGrid.tsx:409-411`). A done session can therefore be stretched to its
    real length after the fact, which erases its error. An update that does this gets a warning
    (`rules.ts:47-48`); a drag in the grid does not.
  - The catch-up "pace" scenario sets each session ahead to `length × pace`, in quarter hours, and marks it `paced`
    (`replan.ts:162-186`, `changes.ts:525-536`).
  - `event.split` shortens the session and adds parts with new uids and the same title (`changes.ts:434-449`).
- What cannot change it: `events.shift` moves start and end together (`changes.ts:511-518`), and the re-balance
  never changes lengths ([rebalancing.md](rebalancing.md), line 378).
- **History cannot be the record of first estimates.**
  - It keeps at most 100 steps and folds older ones into its origin (`history.ts:7`, `113-120`).
  - "Clear the history down to its ends" keeps only the first and the current step, so the changes between them are
    lost (`history.ts:140-148`).
  - A history that no longer matches `edits.json` (after a hand edit, a `git checkout` or a tool writing the file)
    starts over from the current edits (`packages/plan-data/src/store.ts:183-188`).
  - It is untracked (`.gitignore:17`).
  - Measured: `history.json` holds 2 steps, 2026-11-25 04:46:39 and 04:48:38 UTC. The second folds 12 earlier
    changes, and the origin already holds one patch. It reaches back two minutes.
- **The generated baseline gives the first estimate of a generated session.** Every write regenerates the base with
  `buildPlan()` from `content.ts` and `schedule.ts` and applies the edits to it (`store.ts:172-181`). Patches keep only
  what differs from the base (`changes.ts:382-385`). So `buildPlan()`'s length is the original estimate, as long as
  `content.ts` has not changed that module since (it is in git). The estimate itself is coarse: a module is cut into
  `n` sessions of 1 hour (`content.ts:26-31`), a lab is one block of 2 hours (`content.ts:54`), and `QueueItem.hours`
  is `1 | 2` (`types.ts:73-77`). The real estimate is the module's `n`. That is why view 5 exists.
- **A session added in the viewer has no baseline.** Its first length is in `edits.added`, and later patches overwrite
  it in place (`changes.ts:359-373`). Once its creation step has left the history, nothing recovers it. Logging L4
  fixes that.
- Measured: of the 42 patches in `edits.json`, 40 move sessions of one course (34 study, 6 labs), one moves the
  milestone and one a buffer. **None changes a length**: every one of the 131 sessions has today the length
  `buildPlan()` gives it. No session is `paced`.

## 3. The owner's data

All numbers in this section are **measured**, on 2026-11-25 at about 13:00 Minsk time.

| Source | Events | Sessions | Done | With `actual` | `paced` |
| --- | --- | --- | --- | --- | --- |
| `buildPlan()` (generated baseline) | 148 | 131 | 0 | 0 | 0 |
| `data/plan.json` (working tree; equal to `applyEdits(buildPlan(), edits.json)`) | 148 | 131 | 0 | 0 | 0 |
| `data/library/plan-mwvptv4wse8.json`, its one version (2026-11-25 06:01 UTC) | 148 | 131 | 0 | 0 | 0 |
| `data/history.json`, every step's edits | — | — | 0 | 0 | — |
| Every committed `plan.json` / `edits.json` in git (9 snapshots, 2026-11-22 to 11-23) | 148 | — | 0 | 0 | — |

What the plan holds:

- **Sessions** (`isSession`, `progress.ts:22`): 131. There are 125 `study` of 60 minutes and 6 `lab` of 120 minutes.
  All 6 labs are in `certs`. There are no `review` sessions yet. Kind and length are the same split: every study
  session is 1 hour and every lab 2 hours.
- **Per course**: `certs` 40, `hfllm` 35, `pypy` 30, `hfagents` 26.
- **Modules** (titles without the `(i/n)` counter, as `goals.ts:37-38` groups them): 51. Sessions per module:
  1 → 13 modules, 2 → 11, 3 → 16, 4 → 8, 5 → 2, 6 → 1.
- **Weekdays**: Mon 33, Tue 25, Wed 30, Thu 21, Fri 22, none at the weekend. Start hours: 11:00 (46), 12:00 (26),
  13:00 (19), 14:00 (23), 15:00 (17).
- **Course, month and hour are tied together.** `certs` runs 2026-11-26 to 12-29, only at 14:00–16:00. `hfllm` runs
  from 2027-01-04, only at 11:00. `hfagents` runs from 01-04, only at 12:00. `pypy` runs from 01-04 at 11:00 or 13:00,
  12 of its 30 on Mondays and 11 on Wednesdays. December holds only `certs`. A pattern "by time of day" or "by month"
  is a pattern by course until sessions are done at other times than planned, and only L3 would show that.

Coverage: **0 of 131 sessions done, 0 logged, 0 resized, 0 paced.** History reaches back 2 minutes. There is no
error to show yet, and no first estimate that differs from today's.

When groups would fill up, if every session is logged on its planned day:

| Group | 6 logged | 12 logged | 20 logged | All |
| --- | --- | --- | --- | --- |
| `certs` | 2026-11-30 | 12-03 | 12-10 | 40 by 12-29 |
| `hfllm` | 2027-01-12 | 01-20 | 02-01 | 35 by 02-22 |
| `hfagents` | 2027-01-12 | 01-20 | 02-01 | 26 by 02-09 |
| `pypy` | 2027-01-20 | 02-10 | 02-26 | 30 by 03-09 |
| labs (all in `certs`) | 2026-12-29 | — | — | 6 |
| all sessions | 2026-11-30 | — | 12-10 | 131 by 2027-03-09 |

## 4. How many logged sessions before a pattern means anything

### 4.1 A median from few points

The distribution-free interval for a median uses order statistics. For a sample `x(1) ≤ … ≤ x(n)` from a
continuous distribution, `[x(k+1), x(n−k)]` is a "(1 − α(k))100% confidence interval" with
`α(k) = 2P(Zn ≤ k)`, `Zn ∼ Binomial(n, 1/2)` (d, [Yohai & Zamar 2004][yz], eq. 1.3–1.4). Computed from that formula
(inferred, exact arithmetic):

| Logged n | Widest 95% interval | Its coverage | Bounds sit near the sample's |
| --- | --- | --- | --- |
| 3–5 | none: even [min, max] covers only 75–94% | — | — |
| 6 | [min, max] | 96.9% | 14th–86th percentile |
| 8 | [min, max] | 99.2% | 11th–89th |
| 10 | x(2)–x(9) | 97.9% | 18th–82nd |
| 12 | x(3)–x(10) | 96.1% | 23rd–77th |
| 15 | x(4)–x(12) | 96.5% | 25th–75th, about the box of a boxplot |
| 20 | x(6)–x(15) | 95.9% | 29th–71st |
| 30 | x(10)–x(21) | 95.7% | 32nd–68th |

So below 6 logged sessions in a group there is no 95% statement about its typical ratio at all. At 10 the interval
still spans most of the data. Only at about 15–20 does it shrink inside the box. Spolsky's scheduler starts a new
estimator on "a fake history with a wide range of velocities, until they've finished a half-dozen real tasks" (d,
[Spolsky][ebs]), and PROBE needs data "for at least three prior programs" and an r² of at least 0.5 before it
regresses (d, [PSP][psp] §4.2, §4.4, p. 12). Both agree with the order-statistics floor: about six before any summary.

### 4.2 How narrow it gets: a simulation

Inferred, from a simulation in the scratchpad. Assumptions:

- the log of the ratio is normal with spread σ, and the true ratio is ×1.2;
- sessions are 60 minutes, logged as Focus logs them (15-minute steps, at least 15);
- 4,000 runs per row.

Both columns give how wide the 95% interval is, as a factor from its lower to its upper end. The geometric-mean
interval is a t-interval on the mean log ratio.

| σ of log ratio (ratio IQR) | n | Median interval | Geometric-mean interval |
| --- | --- | --- | --- |
| 0.35 (×0.79–×1.27) | 10 | ×2.00 | ×1.63 |
| | 20 | ×1.50 | ×1.39 |
| | 30 | ×1.50 | ×1.30 |
| 0.5 (×0.71–×1.40) | 10 | ×2.67 | ×2.00 |
| | 20 | ×1.75 | ×1.60 |
| | 30 | ×1.50 | ×1.46 |

At σ = 0.35, a course that really runs ×1.2 gets an interval of about ×1.02–×1.42 at n = 20, which just excludes ×1.
A ×1.1 bias needs about `(2.0 × 0.35 ÷ ln 1.1)²` ≈ 54 sessions (inferred). The σ is an assumption; the owner's own
spread replaces it after about 10 logged sessions.

### 4.3 The quarter-hour grid breaks the median

At σ = 0.2 the median interval spans ×1.25 for every n from 15 to 40. It covers the true ×1.2 in only 87%, 82%, 73%
and 68% of runs at n = 15, 20, 30 and 40, falling as n grows. The geometric-mean interval stays at 94–95% (inferred,
same simulation). The cause: logged ratios of 1-hour sessions sit on ×1.00, ×1.25, …, so the sample median snaps to a
grid value and stays there. The order-statistics interval assumes a continuous distribution (d, [Yohai & Zamar][yz],
assumption A1), and quarter-hour logs are not one. Two consequences:

- Use the **geometric mean** (exp of the mean log ratio) as the typical value and its interval, and show the median
  only as part of the dots.
- Let Focus log **whole minutes** (`FocusPage.tsx:66`). The domain already takes any integer 5–1440 (`edits.ts:78`).
  The stepper can keep quarter hours, since a recalled time is no better than that.

### 4.4 What that means for each pattern in the question

| Pattern | Enough points by the end of the plan? (measured counts, inferred verdict) |
| --- | --- |
| By course | Yes for each course: 26–40 sessions, 20 reached between 2026-12-10 and 2027-02-26 |
| By kind | Labs: 6 in all, so a summary is possible only on 2026-12-29 and only for one course. Reviews: none planned |
| By length | Same split as kind (60 = study, 120 = lab): no separate question until lengths vary |
| By weekday | 21–33 per weekday overall, but within a course 2–12; `pypy` has 2–3 on Tue, Thu, Fri. Pooled only, and confounded with course |
| By time of day | No: each course has its own hour, so it is the course question again, unless L3 shows work done at other hours |
| By plan week | 12 h a week is about 10–12 sessions a week: a weekly ratio with n ≈ 10 has an interval of about ×1.6 at σ = 0.35 |
| Over time | Within `certs`: 40 points in 5 weeks, enough for a running mean. Across courses, time equals course |

**What to start logging first** follows from this. Every done session of `certs` needs a time from 2026-11-26 on:
that is the only group that can reach 20 points before the new year (L1). Mark whether each time came from the
stopwatch (L2), so recalled numbers can be told apart. Record the real start (L3) before a weekday or time-of-day
view is built at all.

## 5. Method: how estimation error is measured

### 5.1 Personal process and scheduling practice

- **PSP (Humphrey).** The time recording log notes "the time they started working on a task, the time when they
  stopped the task, and any interruption time … Since interruption time is essentially random, ignoring these times
  would add a large random error into the time data and reduce estimating accuracy" (d, [PSP][psp] §5.1, p. 15). After
  each job a postmortem updates "the project plan summary with actual data" and the historical databases (d, §4,
  p. 13). The plan summary keeps Plan, Actual and To Date columns side by side (d, Table 1). The report charts "Mean
  Time Misestimation" across a course's 10 programs (d, §10, Figure 6, p. 31): estimating error over time is PSP's own
  headline chart, which is view 4.
- **Evidence-Based Scheduling (Spolsky).** "When you divide estimate by actual, you get velocity." A perfect estimator
  has velocities {1, 1, 1, …}, a bad one "all over the map", and a common one "very consistent velocities, but they're
  below 1.0" (d, [Spolsky][ebs]). The future is simulated by dividing each estimate by "a randomly-selected velocity"
  from that person's history (Monte Carlo). On interruptions: "keep the clock running on whatever task you were doing
  when the interruption occurred". He also says to "throw away any velocities older than, say, six months" and to keep
  tasks under 16 hours (d, same post). Velocity is the reciprocal of this app's pace. On a log axis they mirror each
  other, so the app should keep one direction (pace = actual/planned, already in the UI) and label it in words ("took
  25% longer").
- **What EBS's consistency point means here.** A course with a steady ×1.3 is easy to correct. A course "all over the
  map" around ×1 has no bias to correct, but it does need slack. That is why view 2 shows the spread and not only the
  centre.

### 5.2 The planning fallacy and the outside view

- **Buehler, Griffin & Ross (1994), Study 1.** Students predicted their thesis would take 33.9 days, and it took 55.5.
  Only 29.7% finished by their best guess, and only 48.7% by their "as poorly as it possibly could" guess. Yet the
  predictions "were highly correlated with actual completion times (r = .77)" and "can be informative even in the
  presence of a marked prediction bias" (d, [Buehler et al.][bgr], pp. 369–370, Table 1). The error distribution was
  "markedly skewed, with a long tail on the optimistic side of zero" (d, p. 370, note 2). Two lessons for the views:
  - a scatter's correlation says nothing about bias, so the reference must be the ×1 line;
  - expect a right tail (long overruns), which a log axis keeps readable.
- **Kahneman & Tversky (1979) through Flyvbjerg (2006).** People "underestimate the costs, completion times, and risks
  of planned actions" through "insufficient regard to distributional information". The cure is the "outside view":
  "frame the forecasting problem so as to facilitate utilizing all the distributional information that is available"
  (d, [Flyvbjerg][fly], p. 7 of the arXiv copy, quoting [Kahneman & Tversky 1979][kt79], p. 316 (s)). Reference class
  forecasting has three steps:
  1. a reference class "broad enough to be statistically meaningful but narrow enough to be truly comparable";
  2. "a probability distribution for the selected reference class";
  3. "comparing the specific project with the reference class distribution" (d, [Flyvbjerg][fly], p. 8).
  View 3 is this, applied to one session. The class is the same course and kind when it has 6 logged sessions,
  otherwise the same kind across courses, otherwise nothing.

### 5.3 Which error metric

- **Use the ratio, read on a log scale.** Kitchenham et al. take `z = estimate/actual` as "a measure of accuracy".
  They show that MMRE and pred(25) are "measures of the spread and the kurtosis" of z, and that "since the variable z
  is defined on the range 0 to ∞ with a theoretical mean of 1, z must, by definition, be skewed and hence non-Normal".
  They recommend boxplots of z and non-parametric measures (d, [Kitchenham et al.][kit], abstract, §3.1–3.2).
  Tofallis proposes `ln(prediction/actual)`. It is symmetric (swapping the two only changes the sign), and least
  squares on it "predicts the geometric mean" (d, [Tofallis][tof], §2–3.1). The same holds for actual/planned with
  the sign flipped. ×2 and ×0.5 lie the same distance from ×1, which percent error does not give: +100% against −50%.
- **Avoid MRE/MMRE and MAPE as the headline.** MMRE "systematically and consistently ranks models that predict too
  optimistic … estimates highest" (d, [Tofallis][tof] §1, quoting Myrtveit & Stensrud 2012). The reason given there:
  "for strictly positive data, the range for under-prediction is bounded at zero, whilst that for over-prediction is
  not" (d, same, citing Lo & Gao 1997). For a person, a summary that flatters optimistic plans is the wrong one.
- **Keep two summaries for two jobs** (inferred):
  - The **ratio of sums** `Σ actual ÷ Σ planned` is what today's pace is (`progress.ts:49`). It is the right number
    for forecasting total hours, because the forecast multiplies remaining planned hours by it (`forecast.ts:52`).
    It weights a 2-hour lab twice and lets one long outlier move it.
  - The **geometric mean of per-session ratios** is the right "typical session" number for diagnosis and for view 3.
  Show both only where both are needed (view 1), and name them differently.
- **The unit of estimation is the module**, not the session (`content.ts:26-31`). PSP estimates per program, EBS per
  task under 16 hours (d, [PSP][psp], [Spolsky][ebs]). A session can end at its planned hour with the goal unmet and
  the rest done next time. Then its ratio is ×1 and the module overran by a session. View 5 catches that; per-session
  views cannot.

## 6. What time trackers and planners show

A helper session read these pages from each vendor's own help centre, API docs, changelog or blog. I re-read three of
them myself (Sunsama's settings, Akiflow's Stats, Jira's Time Tracking report), and they say what is quoted.
Harvest's help centre returned 403, so its in-app details are (s).

| Product | Where the estimate lives | What it shows against the actual | What it leaves out |
| --- | --- | --- | --- |
| Toggl Track | Per project, or the sum of task estimates, in hours | Projects page: tracked against the estimate in whole hours; "If you've exceeded the time estimate, the actual time tracked will turn red". Project dashboard (paid): a tracking line against a dashed estimate line with a predicted finish. Alerts at 50–150% (d, [Toggl estimates][toggl-est], [dashboard][toggl-dash], [alerts][toggl-alerts]) | No ratio and no history of accuracy; "Alerts cannot be set up for specific project tasks" (d) |
| Clockify | Per project, manual or the sum of task estimates; can recur weekly, monthly or yearly | "15 (of 25h)" with a bar that goes "past 100% to reflect overage"; a per-task table of estimate and tracked; an estimate column in the Summary report; a forecast line that changes colour once over (d, [progress][clockify-progress], [forecast][clockify-forecast]) | A recurring estimate "only shows progress for the current cycle"; the docs suggest a CSV export before it resets (d, [estimates][clockify-est]) |
| Harvest | Budget per project, task or person, in hours or money, optionally monthly | API: `budget`, `budget_spent`, `budget_remaining` (d, [API][harvest-api]). A monthly progress graph that starts each month at 0% spent (d, [blog][harvest-blog]). Budget bars that turn red when over (s) | Budgets only, no estimate per piece of work; no accuracy history (s) |
| Sunsama | "Planned time" per task, summed into the day's workload | Each task shows "the actual and planned times for that day"; an "Actual vs Planned" pair of sums for the day; per weekly objective, time spent and planned (d, [planned and actual][sunsama-pa], [objectives][sunsama-obj]) | A setting "Count planned time as actual time … when no actual time has been recorded", which is claim 2's masking. "Planned time recommendations" learn from "task history" but show no accuracy (d, [settings][sunsama-settings]). The request "Improved Analytics and Data Insights" asks for "actual vs estimate"; it is open (d, [roadmap][sunsama-road]) |
| Motion | Task "Duration" (the estimate), in minutes in the API | A "Completed Time" field tracked once a task starts; dashboards sum "estimated or logged time" (d, [time tracking][motion-tt], [dashboards][motion-dash]) | No documented side-by-side or variance; the API's `completedTime` is a timestamp, not a duration (d, [API][motion-api]) |
| Akiflow | A duration per task | Stats: "Time tracking is calculated from completed task durations only"; "Focus timer data is not included in time statistics" (d, [Stats][akiflow-stats]) | No actual time per task at all: the plan is reported as the time spent. "Track actual vs planned time for each task" is a request (d, [roadmap][akiflow-road]) |
| TickTick | "Estimated Pomo" or "Estimated Duration" per task, not both | On the task, "the actual time you spent will show besides the estimation you set before" (d, [blog][ticktick-blog]). Focus statistics: trend, timeline, a year heatmap, distribution by list, tag or task (d, [Focus Statistics][ticktick-stats]) | The statistics never mention the estimate: the comparison exists per task only (d) |
| Jira | Original estimate, remaining estimate and time spent per work item; sub-tasks roll up | Time Tracking report: Original Estimate, Estimated Time Remaining, Time Spent and Accuracy, "the difference between the sum of the Time Spent and Estimated Time Remaining fields" and the original, per version (d, [report][jira-report]). JQL `workRatio` = time spent ÷ original estimate × 100, as a search filter (d, [workRatio][jira-ratio]) | A difference in hours, not a ratio; one version at a time; outside legacy mode the original estimate can be changed "regardless of any work being logged" (d, [estimates][jira-est]) |

What this means here:

- **Every product compares one estimate with one actual, for one task, project or version, at one moment.** The forms
  are remaining time, a percent of the estimate, a difference in hours, or a red "over" flag. None of the pages read
  shows a distribution of the ratio, bias per category, accuracy over time or a weekday breakdown. That is what views
  2, 4 and 5 add. The absence holds for these pages only, not for the products in general.
- **The two traps in section 2 exist in shipped products.** Sunsama's "count planned time as actual time" and
  Akiflow's Stats both report the plan as the time spent, which is claim 2. Jira's editable original estimate and
  Clockify's cycle reset both drop the first estimate, which is claim 3.
- **The closest thing to view 3 is Sunsama's planned-time recommendation**, which learns from history. But it fills in
  the estimate without saying how sure it is or how many past tasks it used. View 3 shows n.
- Toggl's and Jira's projections answer "when will this finish", which `paceForecast` already answers here
  (`forecast.ts:21-84`), not "where was I wrong".

## 7. Chart forms, judged

Judged with the `dataviz` skill's rules: pick the form by the data's job, and sometimes "the answer is *not a chart*
(a stat tile or hero number)"; "every chart has a table-view twin"; all-pairs forms such as a scatter "cap at
**three**" series; above or below a baseline is a diverging job; one axis only.

| Form | Question it answers | Honest at small n? | Verdict here |
| --- | --- | --- | --- |
| **Plain numbers / table** (n logged of done, typical ratio, interval) | How much evidence, and what does it say? | Yes: n is printed beside the number | **Use** (view 1, and the table twin of 2, 4 and 5) |
| **Strip / dot plot of the ratio on a log axis**, by course | Bias, spread and outliers per group | Yes: every point is shown, nothing is smoothed; ties stack as a beeswarm | **Use** (view 2). It is Kitchenham's boxplot advice drawn as raw points, which suits n < 20 better than a box |
| **Planned vs actual scatter with y = x** | Does error grow with planned length? | Its correlation misleads (Buehler: r = .77 with a 64% overrun); the y = x line fixes that | **Not now**: planned length takes two values (60, 120, measured), so it collapses into two strips. Four courses exceed the three-series cap. Revisit when custom and paced lengths vary |
| **Histogram of the ratio** | Shape of the distribution | No: bins with fewer than about 20 points are noise, and 15-minute steps put all 1-hour ratios on five or six values | **Skip**: the strip shows the same without binning choices |
| **Error by course or kind** (bars of the mean) | Which group runs over? | No: a bar hides n and spread | **Skip as bars**: the strip with its interval answers it (view 2) |
| **Bias over time**: running or cumulative geometric mean | Is the error shrinking or drifting? | Early points swing; draw from n = 6 with the interval band | **Use** (view 4), per course, x = logged-session number, because course and month are tied (measured) |
| **Weekday or time-of-day heatmap** | Which days or hours run over? | No: per course 2–12 sessions a weekday (measured), so a cell of 2 colours noise; a diverging scale would need a neutral midpoint at ×1 | **Not now**: hour equals course and weekday is confounded with it. Reconsider only with L3 and 20+ per pooled weekday |
| **Calendar heatmap** | Day-by-day error | No: one or two sessions a day | **Skip** |
| **Stat tile with a sparkline** | One typical ratio and its trend | Only with n beside it | **Use on Focus as text, not a tile** (view 3); the dashboard keeps the table |

Colour (inferred, from the skill's rules):

- Course identity uses the calendar colour on the dots, as the dashboard already does (`calendarColor`,
  `PaceForecast.tsx:72`).
- Over and under get no hue of their own. Position against the ×1 line carries the sign, and the text says "longer"
  or "shorter". The dashboard already writes the slip with an arrow and words, not colour alone
  (`PaceForecast.tsx:18-23`).
- Kind is a shape (▲ lab, ◇ review), never a second colour.

## 8. Placement: Focus page, Dashboard, both

What each surface shows today:

- **Focus** (`modules/planner/src/pages/focus/ui/FocusPage.tsx`):
  - the session's title, when and "planned {time}" (`262-269`);
  - the stopwatch digits (`295-301`);
  - a bar of elapsed ÷ planned in rhythm mode or with the glass hidden (`303-310`);
  - "{time} left" or "{time} over the plan" (`311-315`);
  - the hourglass counting down the planned session or a work block (`279-290`), and minutes left in the tab title
    (`134-148`);
  - "… is done, {time} logged" after Finish (`414-416`).
  Nothing from past sessions appears.
- **Dashboard** (`modules/dashboard/src/pages/dashboard/ui/DashboardPage.tsx:104-111`):
  - stat tiles, where the "Pace" tile is the schedule lead (`StatTiles.tsx:39-53`);
  - the streak;
  - the burn-up with the pace forecast's finish (`106`);
  - the pace forecast table: per-course pace, hours left planned → needed, plan vs real finish
    (`PaceForecast.tsx:29-126`);
  - weekly load, course bars and a weekly table of planned and done hours (`113-146`).
- **Planner**:
  - "took {time}" on each done session whose logged time differs from its slot, in the grid and the agenda
    (`WeekGrid.tsx:777-779`, `795-800`; `AgendaList.tsx:151-153`);
  - the course list's pace note (`CourseProgress.tsx:40`);
  - the week review's spent hours and pace (`WeekReviewDialog.tsx:61`, `74`).

Placement:

| View | Focus | Dashboard | Why |
| --- | --- | --- | --- |
| 1 Evidence count and honest pace | The count only, inside view 3's line ("n 9") | Full: column in the forecast table | The count qualifies every pace number. It should be one domain function used by the forecast, the course list, the week review and Focus, so the four never disagree |
| 2 Ratio strip | — | Yes, a card after the forecast | Looking back across many sessions; needs width and hover |
| 3 Reference-class expectation | Yes: one line and a tick on the existing bar, from n ≥ 6 | — | The outside view belongs where the plan meets the work (section 5.2). Focus is for one session, so it gets a sentence, not a chart. The glass keeps counting the planned length; the tick shows where "typical" falls |
| 3b This session's ratio after Finish | Yes, appended to the "logged" status line | — | Immediate feedback is what turns logging into a habit (inferred) |
| 4 Bias over time | — | Yes; the week review keeps its weekly ratio, with n | A trend is a look back |
| 5 Module list | — | Yes, in a collapsed `details` like the weekly table | Rarely needed, long |

## 9. Proposed logging and the protocol changes each needs

`PlanChange`, `parseChange`, the JSON Schema and the guide describe one protocol, and `schema.test.ts` fails when
they drift (`schema.test.ts:1`, `27-39`, `49-93`). The browser's changes go through `parseChange`
(`apps/web/src/server/plan.ts:67`, `77`). Updates from tools and chats go through `parseUpdate`, which refuses any
type outside `UPDATE_CHANGE_TYPES` (`update.ts:18`, `64`; `schema.ts:394-408`). That lets a change be app-only, as
`plan.countdown` and `reviews.plan` already are. Every new kind must also name its subject in history
(`history.ts:52-95`, enforced by `satisfies never` at `93`).

### L1. Time on every done session (no protocol change)

- **PlanChange / parseChange / schema / guide**: none. `actual` exists in all four (`edits.ts:76-80`,
  `schema.ts:95-100`, `267-272`, `guide.ts:236-237`).
- **Code**:
  - the card's "Mark done" opens the stepper at once (`EventDialog.tsx:284-289`, `438-442`);
  - `CourseProgress` gains logged sessions, logged planned hours and logged spent hours (`progress.ts:4-19`), and
    views 1–4 use them;
  - Focus logs whole minutes (`FocusPage.tsx:66`).
- **Guide wording to consider**: the worked example marks a session done without time (`guide.ts:63-67`). It is
  correct, but it teaches the unlogged path. Adding `actual` to it would need the example to stay valid against the
  schema test (`schema.test.ts:27-39`).

### L2 and L3. Measured or recalled; real start; paused minutes

One app-only change carries all three, because only the stopwatch knows them.

- **PlanChange**: a new member in `changes.ts:45-102`:
  `{ type: 'session.finish'; uid: string; actual: number; began: string; paused: number }`. `applyChange` turns it
  into an `event.patch` of `{ done: true, actual, measured: true, began, paused }`. Focus sends it instead of the
  plain patch at `FocusPage.tsx:180`.
- **Stored fields**: `EventPatch` (`edits.ts:6-11`) and `PlanEvent` (`types.ts:33-38`) gain:
  - `measured?: true`: the time came from the stopwatch;
  - `began?: string`: when the stopwatch first started, in Minsk wall-clock time;
  - `paused?: number`: minutes it stood between `began` and Finish.
  They are dropped wherever `actual` is dropped (`edits.ts:197-200`, `changes.ts:367-370`, `386`). A later
  `event.patch` that sets `actual` by hand drops them too, because the number is no longer the stopwatch's.
- **parseChange**:
  - a new `case 'session.finish'` validates `actual` like `parsePatch` (integer 5–1440), `began` against `LOCAL_TIME`
    and `paused` as an integer ≥ 0;
  - `parsePatch` reads the three fields back from `edits.json` (`parseEdits` uses it, `edits.ts:137`);
  - the `event.patch` case refuses them from input (`changes.ts:176-182`), so a chat cannot claim stopwatch time.
- **schema.ts**:
  - `PLAN_SCHEMA`'s `EVENT` (`schema.ts:62-105`) documents the three fields as written by the app;
  - `CHANGES` and `UPDATE_CHANGE_TYPES` (`230-408`) stay as they are, since an update cannot carry `session.finish`;
  - the `event.patch` patch keeps `additionalProperties: false` (`schema.ts:255`), so the schema refuses the fields
    just as the parser does.
- **guide.ts**: under "How to give other updates" (`guide.ts:236-237`): "`measured`, `began` and `paused` are written
  by the Focus page's stopwatch: read them, never send them. Time the person tells you goes in `actual` alone, as time
  they recalled."
- **Tests**:
  - `schema.test.ts`, "what the schema refuses the parser refuses too" (`49-93`), gains an `event.patch` carrying
    `began`;
  - `changes.test.ts` covers the drop rules;
  - `history.ts` and `describe-step.ts` name the new step ("Time logged: …" already exists as `history_spent`).

### L4. The first planned length

- **PlanChange**: no new kind. `applyChange` sets `estimate` (minutes) the first time a change alters a session's
  length and never overwrites it. For a generated event it takes the base length (`changes.ts:375-391`), for an
  added one the stored length (`changes.ts:359-373`). `events.move` and `events.shift` reduce to `event.patch`, so they
  are covered (`changes.ts:503-536`). `event.split` gives its first part the whole original as `estimate`, and each
  new part carries the uid it came from, so views can pool the parts (`changes.ts:434-449`).
- **parseChange**: `event.patch` refuses `estimate` from input (`changes.ts:176-182`). `parsePatch` reads it from
  `edits.json` only.
- **schema.ts**: `PLAN_SCHEMA`'s `EVENT` documents `estimate` as read-only; the `event.patch` schema stays closed.
- **guide.ts**: one line beside rule 5 (`guide.ts:150-151`): "`estimate` is the length the app first planned; never
  send it." A model that moves a session then knows the original is kept.
- **Priority**: last. For the 131 generated sessions the baseline already holds the first estimate (section 2.3).

## 10. Open questions only the owner can answer

Section 1.6 takes a default for each one. These are the questions to revisit if a default turns out wrong.

1. **Unlogged done sessions in the pace**: keep them at ×1 (today), leave them out, or show both with the count
   (view 1 as sketched)? The forecast and the catch-up "pace" scenario follow whatever is chosen
   (`forecast.ts:52`, `replan.ts:169-176`).
2. **Focus resolution**: log whole minutes (recommended, section 4.3) or keep quarter hours like the card?
3. **Does a taken break belong to the session?** The stopwatch leaves it out today (`FocusPage.tsx:338-341`). PSP
   subtracts interruptions, while Spolsky keeps "the clock running". L3 would keep both numbers, so this becomes a
   choice of display.
4. **What does "done" mean** when a session ends at its hour with its "Done:" goal unmet? If the rest moves to the
   next session, per-session error hides it and only the module view (5) shows it. Should the card offer
   "unfinished, continues next time"?
5. **Should resizing a done session be refused or warned in the grid**, as updates are warned (`rules.ts:47-48`)?
   Today a drag can erase a session's error (`WeekGrid.tsx:811-824`).
6. **Rename one of the two "Pace"s** on the dashboard (`StatTiles.tsx:40`, `PaceForecast.tsx:55`).

## 11. Sources

Method:

- [Humphrey, *The Personal Software Process (PSP)*, CMU/SEI-2000-TR-022][psp] (PDF from the SEI's repository)
- [Spolsky, "Evidence Based Scheduling" (2007)][ebs]
- [Buehler, Griffin & Ross, "Exploring the 'planning fallacy'", JPSP 67(3) 366–381 (1994)][bgr]
- [Flyvbjerg, "From Nobel Prize to project management: getting risks right", PMJ 37(3) (2006), arXiv copy][fly]
- [Kahneman & Tversky, "Intuitive prediction: biases and corrective procedures" (1977 report; 1979 chapter)][kt79]
  (s: 403 to a script client, quoted through Flyvbjerg)
- [Kitchenham, Pickard, MacDonell & Shepperd, "What accuracy statistics really measure", IEE Proc. Software 148(3)
  (2001)][kit]
- [Tofallis, "A better measure of relative prediction accuracy…", JORS 66 (2015), arXiv copy][tof]
- [Yohai & Zamar, "Robust nonparametric inference for the median", Ann. Statist. 32(5) (2004), arXiv copy][yz]

Products: Toggl Track [estimates][toggl-est] · [project dashboard][toggl-dash] · [alerts][toggl-alerts];
Clockify [progress][clockify-progress] · [estimates][clockify-est] · [forecast chart][clockify-forecast]; Harvest
[budget report API][harvest-api] · [monthly budgets][harvest-blog]; Sunsama [planned and actual][sunsama-pa] ·
[weekly objectives][sunsama-obj] · [settings][sunsama-settings] · [roadmap][sunsama-road]; Motion
[time tracking][motion-tt] · [dashboards][motion-dash] · [API][motion-api]; Akiflow [Stats][akiflow-stats] ·
[roadmap][akiflow-road]; TickTick [Focus Statistics][ticktick-stats] · [blog][ticktick-blog]; Jira
[Time Tracking report][jira-report] · [workRatio][jira-ratio] · [time estimates][jira-est].

Code and data: cited inline as `path:line`. Charts: the `dataviz` skill's references (choosing a form,
anti-patterns, marks).

## 12. What could not be verified

- **Kahneman & Tversky (1979)** returned HTTP 403 from DTIC; its words are quoted from Flyvbjerg's paper.
- **Campbell & Gardner (1988, BMJ)**, the usual medical reference for rank-based median intervals, sits behind a
  browser check at PMC and Europe PMC. Section 4.1 rests on Yohai & Zamar's statement of the same interval instead.
- **The simulation's σ** (0.2, 0.35, 0.5) is assumed. No source read here gives the spread of per-session time ratios
  for one person studying. The tables in 4.2 and 4.3 show the shape of the answer, not the owner's numbers.
- **The PSP book and PROBE's full procedure** were not read; only the SEI technical report was.
- **The planner's own behaviour** was read from code, not run: whether a resize of a done session in the grid really
  saves (section 2.3) was inferred from the handlers, not tried.
- **Products.**
  - Harvest's help centre returned 403, so its budget bars and project analysis are from search snippets (s).
  - TickTick's help centre is rendered by script, so its articles were read from the JSON embedded in the page.
  - The Jira report page read is from the Jira 6.2 documentation. The current Cloud page describes the same columns;
    whether every edition still ships the report was not checked.
  - Motion's "compare estimates and actuals" appears only in a marketing post, so the table does not claim it.
  - No product was used hands-on.

[psp]: https://kilthub.cmu.edu/articles/journal_contribution/The_Personal_Software_Process_PSP_/6585197
[ebs]: https://www.joelonsoftware.com/2007/10/26/evidence-based-scheduling/
[bgr]: https://bear.warrington.ufl.edu/brenner/mar7588/Papers/buehler-et-al-1994.pdf
[fly]: https://arxiv.org/abs/1302.3642
[kt79]: https://apps.dtic.mil/sti/pdfs/ADA047747.pdf
[kit]: https://hdl.handle.net/10292/2179
[tof]: https://arxiv.org/abs/2105.05249
[yz]: https://arxiv.org/abs/math/0503665
[toggl-est]: https://support.toggl.com/project-time-estimates
[toggl-dash]: https://support.toggl.com/project-dashboard
[toggl-alerts]: https://support.toggl.com/en/articles/2220838-alerts
[clockify-progress]: https://clockify.me/help/projects/tracking-project-progress
[clockify-est]: https://clockify.me/help/troubleshooting/project-issues/understanding-project-estimates
[clockify-forecast]: https://clockify.me/help/projects/forecast-chart
[harvest-api]: https://help.getharvest.com/api-v2/reports-api/reports/project-budget-report/
[harvest-blog]: https://www.getharvest.com/blog/2018/06/more-powerful-budgeting-to-keep-your-monthly-retainers-on-track
[sunsama-pa]: https://help.sunsama.com/docs/usage-guides/tasks/planned-and-actual-times/
[sunsama-obj]: https://help.sunsama.com/docs/usage-guides/weekly-objectives/
[sunsama-settings]: https://help.sunsama.com/docs/user-settings
[sunsama-road]: https://roadmap.sunsama.com/improvements/p/review-completed-task-over-time
[motion-tt]: https://www.usemotion.com/blog/introducing-enhanced-time-tracking-in-motion
[motion-dash]: https://www.usemotion.com/help/project-management/dashboards/dashboards-how-to-guide
[motion-api]: https://docs.usemotion.com/api-reference/tasks/get/
[akiflow-stats]: https://product.akiflow.com/help/articles/9117511-stats
[akiflow-road]: https://product.akiflow.com/p/time-tracking-and-analytics
[ticktick-stats]: https://help.ticktick.com/articles/7055781966800486400
[ticktick-blog]: https://blog.ticktick.com/2020/12/08/20-lesser-known-ticktick-features/
[jira-report]: https://confluence.atlassian.com/jira062/time-tracking-report-588581603.html
[jira-ratio]: https://support.atlassian.com/jira/kb/how-to-search-for-issues-where-the-time-spent-is-more-than-the-original-estimate/
[jira-est]: https://support.atlassian.com/jira-software-cloud/docs/what-are-time-estimates-days-hours-minutes/
